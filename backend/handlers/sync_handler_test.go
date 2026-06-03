package handlers

import (
	"encoding/json"
	"testing"
	"time"

	"backend/models"
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
