package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/middleware"
	"backend/models"

	"github.com/google/uuid"
)

func TestAPIPagination(t *testing.T) {
	tests := []struct {
		query      string
		wantLimit  int
		wantOffset int
	}{
		{"", 200, 0},
		{"?limit=25&offset=50", 25, 50},
		{"?limit=5000&offset=-2", 1000, 0},
		{"?limit=invalid&offset=invalid", 200, 0},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/workouts"+tt.query, nil)
		limit, offset := apiPagination(req)
		if limit != tt.wantLimit || offset != tt.wantOffset {
			t.Errorf("%q: got (%d, %d), want (%d, %d)", tt.query, limit, offset, tt.wantLimit, tt.wantOffset)
		}
	}
}

func TestAPIInfoHandlerListsResources(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/", nil)
	rec := httptest.NewRecorder()
	APIInfoHandler(rec, req)

	var body struct {
		Resources []string `json:"resources"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode index response: %v", err)
	}
	want := []string{
		"/api/v1/exercises",
		"/api/v1/workouts",
		"/api/v1/body-weights",
		"/api/v1/workout-groups",
		"/api/v1/workout-routines",
	}
	for _, resource := range want {
		found := false
		for _, got := range body.Resources {
			if got == resource {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("index resources missing %q, got %v", resource, body.Resources)
		}
	}
}

func TestAPIHandlersRequireUser(t *testing.T) {
	tests := []struct {
		path    string
		handler http.HandlerFunc
	}{
		{"/api/v1/exercises", APIExercisesHandler},
		{"/api/v1/workouts", APIWorkoutsHandler},
		{"/api/v1/body-weights", APIBodyWeightsHandler},
		{"/api/v1/workout-groups", APIWorkoutGroupsHandler},
		{"/api/v1/workout-routines", APIWorkoutRoutinesHandler},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, tt.path, nil)
		rec := httptest.NewRecorder()
		tt.handler(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s without user context: got status %d, want %d", tt.path, rec.Code, http.StatusUnauthorized)
		}
	}
}

func TestAPIHandlersRejectInvalidDates(t *testing.T) {
	tests := []struct {
		path    string
		handler http.HandlerFunc
	}{
		{"/api/v1/workouts", APIWorkoutsHandler},
		{"/api/v1/body-weights", APIBodyWeightsHandler},
		{"/api/v1/workout-groups", APIWorkoutGroupsHandler},
		{"/api/v1/workout-routines", APIWorkoutRoutinesHandler},
	}
	for _, tt := range tests {
		for _, query := range []string{"?from=07/23/2026", "?to=not-a-date", "?from=2026-02-30"} {
			req := httptest.NewRequest(http.MethodGet, tt.path+query, nil)
			req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, uuid.New()))
			rec := httptest.NewRecorder()
			tt.handler(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s%s: got status %d, want %d", tt.path, query, rec.Code, http.StatusBadRequest)
			}
		}
	}
}

// getAPIRead invokes a read-API handler with an authenticated user context and
// decodes the standard {"data": ...} envelope into out.
func getAPIRead(t *testing.T, handler http.HandlerFunc, path string, userID uuid.UUID, out any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID))
	rec := httptest.NewRecorder()
	handler(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s returned status %d: %s", path, rec.Code, rec.Body.String())
	}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&envelope); err != nil {
		t.Fatalf("%s: failed to decode envelope: %v", path, err)
	}
	if err := json.Unmarshal(envelope.Data, out); err != nil {
		t.Fatalf("%s: failed to decode data: %v", path, err)
	}
}

// Integration coverage for the superset and routine-link read endpoints. Gated
// behind TEST_DATABASE_URL exactly like the sync integration tests.
func TestAPIWorkoutGroupsAndRoutinesIntegration(t *testing.T) {
	userID, token := createSyncTestUser(t)
	base := syncTestBase()

	exA, exB := uuid.New(), uuid.New()
	routineID, sectionID := uuid.New(), uuid.New()
	sectionExID, templateSetID := uuid.New(), uuid.New()
	loggedGroupID, templateGroupID := uuid.New(), uuid.New()
	wgeA, wgeB := uuid.New(), uuid.New()
	wrWithSection, wrWithoutSection := uuid.New(), uuid.New()
	logID := uuid.New()

	logWeight := 100.0
	logReps := 5
	setWeight := 60.0
	setReps := 8

	postSync(t, token, SyncRequest{
		Exercises: []models.Exercise{
			{ID: exA, Name: "Bench Press", ExerciseTypeID: 0, LastModified: base},
			{ID: exB, Name: "Squat", ExerciseTypeID: 0, LastModified: base},
		},
		Routines: []models.Routine{
			{ID: routineID, Name: "PPL", Version: 1, ProgramWeeks: 1, CurrentWeek: 1, LastModified: base},
		},
		RoutineSections: []models.RoutineSection{
			{ID: sectionID, RoutineID: routineID, Name: "Push", SortOrder: 0, WeekNumber: 1, LastModified: base},
		},
		RoutineSectionExercises: []models.RoutineSectionExercise{
			{ID: sectionExID, RoutineSectionID: sectionID, ExerciseID: exA, SortOrder: 0, PopulateSetsType: 1, LastModified: base},
		},
		RoutineSectionExerciseSets: []models.RoutineSectionExerciseSet{
			{ID: templateSetID, RoutineSectionExerciseID: sectionExID, MetricWeight: &setWeight, Reps: &setReps, SortOrder: 0, SetType: "working", LastModified: base},
		},
		TrainingLogs: []models.TrainingLog{
			{ID: logID, ExerciseID: exA, Date: "2026-07-20", MetricWeight: &logWeight, Reps: &logReps, RoutineSectionExerciseSetID: &templateSetID, IsComplete: true, SetType: "working", LastModified: base},
		},
		WorkoutGroups: []models.WorkoutGroup{
			// A superset performed on a real calendar date.
			{ID: loggedGroupID, Name: "Superset 1", Date: "2026-07-20", Colour: 3, LastModified: base},
			// A routine-template superset (sentinel empty date) must be excluded.
			{ID: templateGroupID, Name: "Template superset", Date: "", Colour: 1, RoutineSectionID: &sectionID, LastModified: base},
		},
		WorkoutGroupExercises: []models.WorkoutGroupExercise{
			{ID: wgeA, ExerciseID: exA, Date: "2026-07-20", WorkoutGroupID: loggedGroupID, LastModified: base},
			{ID: wgeB, ExerciseID: exB, Date: "2026-07-20", WorkoutGroupID: loggedGroupID, LastModified: base},
		},
		WorkoutRoutines: []models.WorkoutRoutine{
			{ID: wrWithSection, Date: "2026-07-20", RoutineID: routineID, RoutineSectionID: &sectionID, LastModified: base},
			{ID: wrWithoutSection, Date: "2026-07-21", RoutineID: routineID, LastModified: base},
		},
	})

	// Workout groups: only the logged superset comes back.
	var groups []apiWorkoutGroup
	getAPIRead(t, APIWorkoutGroupsHandler, "/api/v1/workout-groups", userID, &groups)
	if len(groups) != 1 {
		t.Fatalf("workout-groups returned %d rows, want 1 (templates excluded): %+v", len(groups), groups)
	}
	group := groups[0]
	if group.ID != loggedGroupID || group.Name != "Superset 1" || group.Date != "2026-07-20" || group.Colour != 3 {
		t.Errorf("workout group mismatch: %+v", group)
	}
	wantIDs := []uuid.UUID{exA, exB}
	if bytes.Compare(wgeA[:], wgeB[:]) > 0 {
		wantIDs = []uuid.UUID{exB, exA} // rows are ordered by workout_group_exercises.id
	}
	if len(group.ExerciseIDs) != 2 || group.ExerciseIDs[0] != wantIDs[0] || group.ExerciseIDs[1] != wantIDs[1] {
		t.Errorf("exercise_ids = %v, want %v", group.ExerciseIDs, wantIDs)
	}

	// Date filters apply to workout groups.
	var filtered []apiWorkoutGroup
	getAPIRead(t, APIWorkoutGroupsHandler, "/api/v1/workout-groups?from=2026-07-21", userID, &filtered)
	if len(filtered) != 0 {
		t.Errorf("workout-groups?from=2026-07-21 returned %d rows, want 0", len(filtered))
	}

	// Workout routines: both rows, date DESC, section fields nullable.
	var routines []apiWorkoutRoutine
	getAPIRead(t, APIWorkoutRoutinesHandler, "/api/v1/workout-routines", userID, &routines)
	if len(routines) != 2 {
		t.Fatalf("workout-routines returned %d rows, want 2: %+v", len(routines), routines)
	}
	if routines[0].ID != wrWithoutSection || routines[0].Date != "2026-07-21" {
		t.Errorf("expected %s (2026-07-21) first, got %+v", wrWithoutSection, routines[0])
	}
	if routines[0].RoutineName != "PPL" || routines[0].RoutineSectionID != nil || routines[0].SectionName != nil {
		t.Errorf("routine without section mismatch: %+v", routines[0])
	}
	withSection := routines[1]
	if withSection.ID != wrWithSection || withSection.RoutineName != "PPL" {
		t.Errorf("routine with section mismatch: %+v", withSection)
	}
	if withSection.RoutineSectionID == nil || *withSection.RoutineSectionID != sectionID {
		t.Errorf("routine_section_id = %v, want %s", withSection.RoutineSectionID, sectionID)
	}
	if withSection.SectionName == nil || *withSection.SectionName != "Push" {
		t.Errorf("section_name = %v, want Push", withSection.SectionName)
	}

	// Workouts: the set exposes its routine-template set link.
	var sets []apiWorkoutSet
	getAPIRead(t, APIWorkoutsHandler, "/api/v1/workouts", userID, &sets)
	if len(sets) != 1 {
		t.Fatalf("workouts returned %d rows, want 1: %+v", len(sets), sets)
	}
	if sets[0].ID != logID || sets[0].RoutineSectionExerciseSetID == nil || *sets[0].RoutineSectionExerciseSetID != templateSetID {
		t.Errorf("routine_section_exercise_set_id = %v, want %s", sets[0].RoutineSectionExerciseSetID, templateSetID)
	}
}

func TestValidDateFilter(t *testing.T) {
	for _, value := range []string{"", "2026-07-23", "2000-02-29"} {
		if !validDateFilter(value) {
			t.Errorf("validDateFilter(%q) = false, want true", value)
		}
	}
	for _, value := range []string{"07/23/2026", "2026-02-30", "tomorrow"} {
		if validDateFilter(value) {
			t.Errorf("validDateFilter(%q) = true, want false", value)
		}
	}
}
