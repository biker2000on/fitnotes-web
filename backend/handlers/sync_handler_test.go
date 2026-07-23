package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"backend/db"
	"backend/middleware"
	"backend/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSyncPayloadJSONSerialization(t *testing.T) {
	// 1. Create a mock SyncRequest containing our new premium fields
	req := SyncRequest{
		LastSyncTimestamp: time.Now().UTC(),
		Categories: []models.Category{
			{Name: "Chest", Colour: -1},
		},
		WorkoutGroups: []models.WorkoutGroup{
			{Name: "Superset 1", Date: "2026-05-27", Colour: -48060, AutoJumpEnabled: true},
			{Name: "Superset 2", Date: "", Colour: -5609780, AutoJumpEnabled: true}, // Routine template superset (empty date)
		},
		WorkoutGroupExercises: []models.WorkoutGroupExercise{
			{Date: "2026-05-27"},
			{Date: ""}, // Routine template superset link (empty date)
		},
	}

	// 2. Marshal to JSON
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Failed to marshal SyncRequest: %v", err)
	}

	// 3. Unmarshal back to SyncRequest
	var decodedReq SyncRequest
	if err := json.Unmarshal(data, &decodedReq); err != nil {
		t.Fatalf("Failed to unmarshal SyncRequest: %v", err)
	}

	// 4. Assertions on premium fields
	if len(decodedReq.WorkoutGroups) != 2 {
		t.Errorf("Expected 2 WorkoutGroups, got %d", len(decodedReq.WorkoutGroups))
	}
	if decodedReq.WorkoutGroups[0].Name != "Superset 1" || decodedReq.WorkoutGroups[0].Date != "2026-05-27" {
		t.Errorf("Mismatch in first WorkoutGroup values")
	}
	if decodedReq.WorkoutGroups[1].Date != "" {
		t.Errorf("Expected empty date string for routine workout group, got %s", decodedReq.WorkoutGroups[1].Date)
	}
	if len(decodedReq.WorkoutGroupExercises) != 2 {
		t.Errorf("Expected 2 WorkoutGroupExercises, got %d", len(decodedReq.WorkoutGroupExercises))
	}
}

func TestSyncPayloadRoutinesGoalsMeasurements(t *testing.T) {
	title := "Bench 100kg"
	target := 100.0
	td := "2026-12-31"
	comment := "morning"

	req := SyncRequest{
		LastSyncTimestamp:          time.Now().UTC(),
		Routines:                   []models.Routine{{Name: "PPL"}},
		RoutineSections:            []models.RoutineSection{{Name: "Push", SortOrder: 0}},
		RoutineSectionExercises:    []models.RoutineSectionExercise{{SortOrder: 0, PopulateSetsType: 1}},
		RoutineSectionExerciseSets: []models.RoutineSectionExerciseSet{{SortOrder: 0, Reps: intPtr(5)}},
		Goals:                      []models.Goal{{TypeID: 1, MetricWeight: &target, Title: &title, TargetDate: &td}},
		Measurements:               []models.Measurement{{Name: "Neck", UnitID: 1, Custom: true, Enabled: true}},
		MeasurementRecords:         []models.MeasurementRecord{{Date: "2026-05-27", Time: "08:30:00", Value: 40.5, Comment: &comment}},
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Failed to marshal SyncRequest: %v", err)
	}

	var decoded SyncRequest
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal SyncRequest: %v", err)
	}

	if len(decoded.Routines) != 1 || decoded.Routines[0].Name != "PPL" {
		t.Errorf("Routine round-trip failed: %+v", decoded.Routines)
	}
	if len(decoded.RoutineSectionExerciseSets) != 1 || decoded.RoutineSectionExerciseSets[0].Reps == nil || *decoded.RoutineSectionExerciseSets[0].Reps != 5 {
		t.Errorf("Routine set round-trip failed: %+v", decoded.RoutineSectionExerciseSets)
	}
	if len(decoded.Goals) != 1 || decoded.Goals[0].MetricWeight == nil || *decoded.Goals[0].MetricWeight != 100.0 {
		t.Errorf("Goal round-trip failed: %+v", decoded.Goals)
	}
	if len(decoded.Goals) == 1 && (decoded.Goals[0].TargetDate == nil || *decoded.Goals[0].TargetDate != "2026-12-31") {
		t.Errorf("Goal target_date round-trip failed: %+v", decoded.Goals[0])
	}
	if len(decoded.Measurements) != 1 || decoded.Measurements[0].Name != "Neck" {
		t.Errorf("Measurement round-trip failed: %+v", decoded.Measurements)
	}
	if len(decoded.MeasurementRecords) != 1 || decoded.MeasurementRecords[0].Time != "08:30:00" || decoded.MeasurementRecords[0].Value != 40.5 {
		t.Errorf("MeasurementRecord round-trip failed: %+v", decoded.MeasurementRecords)
	}
}

func intPtr(i int) *int { return &i }

func TestWithingsBoolUnmarshal(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{`true`, true},
		{`false`, false},
		{`1`, true},
		{`0`, false},
		{`"1"`, true},
		{`"0"`, false},
	}

	for _, tt := range tests {
		var got withingsBool
		if err := json.Unmarshal([]byte(tt.input), &got); err != nil {
			t.Fatalf("json.Unmarshal(%s) returned error: %v", tt.input, err)
		}
		if got.Bool() != tt.want {
			t.Fatalf("json.Unmarshal(%s) = %v, want %v", tt.input, got.Bool(), tt.want)
		}
	}

	var invalid withingsBool
	if err := json.Unmarshal([]byte(`"maybe"`), &invalid); err == nil {
		t.Fatal("expected invalid Withings boolean to return an error")
	}
}

func TestDateParsingLogic(t *testing.T) {
	testCases := []struct {
		inputDate string
		shouldErr bool
		isZero    bool
	}{
		{"2026-05-27", false, false},
		{"", false, true}, // empty date string should convert to zero time without error
		{"invalid-date", true, false},
	}

	for _, tc := range testCases {
		var parsedDate time.Time
		var err error

		if tc.inputDate == "" {
			parsedDate = time.Time{}
		} else {
			parsedDate, err = time.Parse("2006-01-02", tc.inputDate)
		}

		if tc.shouldErr && err == nil {
			t.Errorf("Expected error for date '%s', but got nil", tc.inputDate)
		}
		if !tc.shouldErr && err != nil {
			t.Errorf("Unexpected error for date '%s': %v", tc.inputDate, err)
		}
		if !tc.shouldErr && tc.isZero && !parsedDate.IsZero() {
			t.Errorf("Expected zero time for empty date input, but got %v", parsedDate)
		}
		if !tc.shouldErr && !tc.isZero && parsedDate.Format("2006-01-02") != tc.inputDate {
			t.Errorf("Parsed date format mismatch: expected '%s', got '%s'", tc.inputDate, parsedDate.Format("2006-01-02"))
		}
	}
}

// ---------------------------------------------------------------------------
// Integration tests for POST /api/sync against a real Postgres.
//
// These are gated behind TEST_DATABASE_URL (skipped when unset), e.g.:
//
//	TEST_DATABASE_URL=postgres://postgres:postgrespassword@localhost:5432/fitnotes?sslmode=disable go test ./handlers
//
// Each test creates a throwaway user (random UUID email) and deletes it on
// cleanup; every synced table cascades from users, so no dev data is touched.
// ---------------------------------------------------------------------------

var (
	syncItOnce sync.Once
	syncItPool *pgxpool.Pool
	syncItErr  error
)

// syncTestDB returns a pool connected to TEST_DATABASE_URL, skipping the test
// when the env var is unset. It reuses db.InitDB so the same migration logic
// that runs in production prepares the schema.
func syncTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	connStr := os.Getenv("TEST_DATABASE_URL")
	if connStr == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping sync integration test")
	}
	syncItOnce.Do(func() {
		os.Setenv("DATABASE_URL", connStr)
		syncItPool, syncItErr = db.InitDB()
	})
	if syncItErr != nil {
		t.Fatalf("failed to connect to test database: %v", syncItErr)
	}
	if syncItPool == nil {
		t.Fatal("test database pool not initialised")
	}
	return syncItPool
}

// createSyncTestUser inserts a hermetic user and returns its ID plus a valid
// bearer token. The user (and, via FK cascades, everything synced for it) is
// removed on test cleanup.
func createSyncTestUser(t *testing.T) (uuid.UUID, string) {
	t.Helper()
	pool := syncTestDB(t)

	userID := uuid.New()
	email := fmt.Sprintf("sync-test-%s@example.invalid", userID)
	if _, err := pool.Exec(context.Background(),
		"INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
		userID, email, "integration-test-only",
	); err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userID); err != nil {
			t.Errorf("failed to clean up test user %s: %v", userID, err)
		}
	})

	token, err := middleware.GenerateToken(userID)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	return userID, token
}

// postSync round-trips a SyncRequest through the real auth middleware and
// SyncHandler, exactly as a client hitting POST /api/sync would.
func postSync(t *testing.T, token string, req SyncRequest) SyncResponse {
	t.Helper()
	body, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal sync request: %v", err)
	}

	httpReq := httptest.NewRequest(http.MethodPost, "/api/sync", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	middleware.AuthMiddleware(http.HandlerFunc(SyncHandler)).ServeHTTP(rec, httpReq)
	if rec.Code != http.StatusOK {
		t.Fatalf("sync returned status %d: %s", rec.Code, rec.Body.String())
	}

	var resp SyncResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode sync response: %v", err)
	}
	return resp
}

func findCategory(t *testing.T, list []models.Category, id uuid.UUID) models.Category {
	t.Helper()
	for _, c := range list {
		if c.ID == id {
			return c
		}
	}
	t.Fatalf("category %s not found in pull response (%d categories)", id, len(list))
	return models.Category{}
}

// syncTestBase returns a fixed timestamp safely in the past so that pushed
// last_modified values always precede the handler's server_time.
func syncTestBase() time.Time {
	return time.Now().UTC().Add(-2 * time.Hour).Truncate(time.Millisecond)
}

func TestSyncRoundTripAcrossClients(t *testing.T) {
	_, token := createSyncTestUser(t)
	base := syncTestBase()

	catID := uuid.New()
	exID := uuid.New()
	logID := uuid.New()
	routineID := uuid.New()
	sectionID := uuid.New()
	sectionExID := uuid.New()
	setID := uuid.New()

	logWeight := 102.5
	logReps := 5
	setWeight := 60.0
	setReps := 8

	// Client A pushes a full FK chain: category -> exercise -> training log,
	// and routine -> section -> section exercise -> set.
	push := SyncRequest{
		Categories: []models.Category{
			{ID: catID, Name: "Chest", Colour: -48060, SortOrder: 1, LastModified: base},
		},
		Exercises: []models.Exercise{
			{ID: exID, Name: "Bench Press", CategoryID: &catID, ExerciseTypeID: 0, LastModified: base},
		},
		Routines: []models.Routine{
			{ID: routineID, Name: "PPL", Version: 1, ProgramWeeks: 1, CurrentWeek: 1, LastModified: base},
		},
		RoutineSections: []models.RoutineSection{
			{ID: sectionID, RoutineID: routineID, Name: "Push", SortOrder: 0, WeekNumber: 1, LastModified: base},
		},
		RoutineSectionExercises: []models.RoutineSectionExercise{
			{ID: sectionExID, RoutineSectionID: sectionID, ExerciseID: exID, SortOrder: 0, PopulateSetsType: 1, ProgressionRepsStep: 1, LastModified: base},
		},
		RoutineSectionExerciseSets: []models.RoutineSectionExerciseSet{
			{ID: setID, RoutineSectionExerciseID: sectionExID, MetricWeight: &setWeight, Reps: &setReps, SortOrder: 0, SetType: "working", LastModified: base},
		},
		TrainingLogs: []models.TrainingLog{
			{ID: logID, ExerciseID: exID, Date: "2026-07-20", MetricWeight: &logWeight, Reps: &logReps, RoutineSectionExerciseSetID: &setID, IsComplete: true, SetType: "working", LastModified: base},
		},
	}
	respA := postSync(t, token, push)
	if respA.ServerTime.IsZero() {
		t.Fatal("expected non-zero server_time in sync response")
	}

	// Fresh client B (zero last_sync_timestamp, nothing to push) pulls everything.
	respB := postSync(t, token, SyncRequest{})

	cat := findCategory(t, respB.Categories, catID)
	if cat.Name != "Chest" || cat.Colour != -48060 || cat.SortOrder != 1 || cat.IsDeleted {
		t.Errorf("category round-trip mismatch: %+v", cat)
	}

	var gotExercise bool
	for _, e := range respB.Exercises {
		if e.ID == exID {
			gotExercise = true
			if e.Name != "Bench Press" || e.CategoryID == nil || *e.CategoryID != catID {
				t.Errorf("exercise round-trip mismatch: %+v", e)
			}
		}
	}
	if !gotExercise {
		t.Fatalf("exercise %s not found in pull response", exID)
	}

	var gotRoutine bool
	for _, r := range respB.Routines {
		if r.ID == routineID {
			gotRoutine = true
			if r.Name != "PPL" {
				t.Errorf("routine round-trip mismatch: %+v", r)
			}
		}
	}
	if !gotRoutine {
		t.Fatalf("routine %s not found in pull response", routineID)
	}

	var gotSection bool
	for _, s := range respB.RoutineSections {
		if s.ID == sectionID {
			gotSection = true
			if s.RoutineID != routineID || s.Name != "Push" {
				t.Errorf("routine section round-trip mismatch: %+v", s)
			}
		}
	}
	if !gotSection {
		t.Fatalf("routine section %s not found in pull response", sectionID)
	}

	var gotSectionEx bool
	for _, se := range respB.RoutineSectionExercises {
		if se.ID == sectionExID {
			gotSectionEx = true
			if se.RoutineSectionID != sectionID || se.ExerciseID != exID {
				t.Errorf("routine section exercise round-trip mismatch: %+v", se)
			}
		}
	}
	if !gotSectionEx {
		t.Fatalf("routine section exercise %s not found in pull response", sectionExID)
	}

	var gotSet bool
	for _, s := range respB.RoutineSectionExerciseSets {
		if s.ID == setID {
			gotSet = true
			if s.RoutineSectionExerciseID != sectionExID ||
				s.MetricWeight == nil || *s.MetricWeight != setWeight ||
				s.Reps == nil || *s.Reps != setReps {
				t.Errorf("routine section exercise set round-trip mismatch: %+v", s)
			}
		}
	}
	if !gotSet {
		t.Fatalf("routine section exercise set %s not found in pull response", setID)
	}

	var gotLog bool
	for _, l := range respB.TrainingLogs {
		if l.ID == logID {
			gotLog = true
			if l.ExerciseID != exID || l.Date != "2026-07-20" ||
				l.MetricWeight == nil || *l.MetricWeight != logWeight ||
				l.Reps == nil || *l.Reps != logReps ||
				l.RoutineSectionExerciseSetID == nil || *l.RoutineSectionExerciseSetID != setID ||
				!l.IsComplete {
				t.Errorf("training log round-trip mismatch: %+v", l)
			}
		}
	}
	if !gotLog {
		t.Fatalf("training log %s not found in pull response", logID)
	}
}

func TestSyncLastWriteWins(t *testing.T) {
	_, token := createSyncTestUser(t)
	base := syncTestBase()
	catID := uuid.New()

	pushCategory := func(name string, lastModified time.Time) SyncResponse {
		return postSync(t, token, SyncRequest{
			Categories: []models.Category{
				{ID: catID, Name: name, Colour: -1, SortOrder: 0, LastModified: lastModified},
			},
		})
	}

	// Initial write.
	pushCategory("Current", base)

	// A stale write (older last_modified) must NOT overwrite the row.
	resp := pushCategory("Stale", base.Add(-30*time.Minute))
	if got := findCategory(t, resp.Categories, catID); got.Name != "Current" {
		t.Errorf("stale push overwrote newer row: name = %q, want %q", got.Name, "Current")
	}

	// A newer write must overwrite the row.
	newer := base.Add(30 * time.Minute)
	resp = pushCategory("Newer", newer)
	got := findCategory(t, resp.Categories, catID)
	if got.Name != "Newer" {
		t.Errorf("newer push did not overwrite row: name = %q, want %q", got.Name, "Newer")
	}
	if !got.LastModified.Equal(newer) {
		t.Errorf("last_modified = %v, want %v", got.LastModified, newer)
	}
}

func TestSyncDeletePropagation(t *testing.T) {
	_, token := createSyncTestUser(t)
	base := syncTestBase()

	catID := uuid.New()
	exID := uuid.New()
	logID := uuid.New()
	weight := 80.0
	reps := 10

	// Client A creates a category, exercise, and training log.
	postSync(t, token, SyncRequest{
		Categories: []models.Category{
			{ID: catID, Name: "Legs", Colour: -1, SortOrder: 0, LastModified: base},
		},
		Exercises: []models.Exercise{
			{ID: exID, Name: "Squat", CategoryID: &catID, LastModified: base},
		},
		TrainingLogs: []models.TrainingLog{
			{ID: logID, ExerciseID: exID, Date: "2026-07-21", MetricWeight: &weight, Reps: &reps, SetType: "working", LastModified: base},
		},
	})

	// Client B confirms the rows are alive.
	respB := postSync(t, token, SyncRequest{})
	if got := findCategory(t, respB.Categories, catID); got.IsDeleted {
		t.Fatalf("category unexpectedly deleted before tombstone push: %+v", got)
	}

	// Client A soft-deletes the training log and the category.
	deletedAt := base.Add(time.Minute)
	postSync(t, token, SyncRequest{
		Categories: []models.Category{
			{ID: catID, Name: "Legs", Colour: -1, SortOrder: 0, LastModified: deletedAt, IsDeleted: true},
		},
		TrainingLogs: []models.TrainingLog{
			{ID: logID, ExerciseID: exID, Date: "2026-07-21", MetricWeight: &weight, Reps: &reps, SetType: "working", LastModified: deletedAt, IsDeleted: true},
		},
	})

	// Client B pulls again from scratch and must receive the tombstones.
	respB = postSync(t, token, SyncRequest{})
	if got := findCategory(t, respB.Categories, catID); !got.IsDeleted {
		t.Errorf("category tombstone did not propagate: %+v", got)
	}
	var gotLog bool
	for _, l := range respB.TrainingLogs {
		if l.ID == logID {
			gotLog = true
			if !l.IsDeleted {
				t.Errorf("training log tombstone did not propagate: %+v", l)
			}
		}
	}
	if !gotLog {
		t.Fatalf("deleted training log %s missing from pull response", logID)
	}
}

func TestSyncIncrementalPull(t *testing.T) {
	_, token := createSyncTestUser(t)
	base := syncTestBase()

	catID := uuid.New()
	exID := uuid.New()

	resp := postSync(t, token, SyncRequest{
		Categories: []models.Category{
			{ID: catID, Name: "Back", Colour: -1, SortOrder: 0, LastModified: base},
		},
		Exercises: []models.Exercise{
			{ID: exID, Name: "Deadlift", CategoryID: &catID, LastModified: base},
		},
	})
	if resp.ServerTime.IsZero() {
		t.Fatal("expected non-zero server_time in sync response")
	}

	// A follow-up sync using the returned server_time must yield no rows.
	second := postSync(t, token, SyncRequest{LastSyncTimestamp: resp.ServerTime})

	total := len(second.Categories) + len(second.Exercises) + len(second.Routines) +
		len(second.RoutineSections) + len(second.RoutineSectionExercises) +
		len(second.RoutineSectionExerciseSets) + len(second.TrainingLogs) +
		len(second.BodyWeights) + len(second.Plates) + len(second.Barbells) +
		len(second.WorkoutComments) + len(second.WorkoutGroups) +
		len(second.WorkoutGroupExercises) + len(second.WorkoutRoutines) +
		len(second.Goals) + len(second.Measurements) + len(second.MeasurementRecords) +
		len(second.ExerciseComments) + len(second.WorkoutTimes) + len(second.CustomUnits) +
		len(second.GraphFavourites)
	if total != 0 {
		t.Errorf("incremental pull returned %d rows, want 0: %+v", total, second)
	}
	if second.Settings != nil {
		t.Errorf("incremental pull returned settings, want nil: %+v", second.Settings)
	}
}
