package handlers

import (
	"backend/middleware"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend/models"

	"github.com/google/uuid"
)

func TestCompletionTimingSyncAndReadAPI(t *testing.T) {
	userID, token := createSyncTestUser(t)
	base := syncTestBase()
	exerciseID := uuid.New()
	log := models.TrainingLog{ID: uuid.New(), ExerciseID: exerciseID, Date: "2026-09-15", IsComplete: true, CompletedAt: &base, LastModified: base}
	postSync(t, token, SyncRequest{Exercises: []models.Exercise{{ID: exerciseID, Name: "Squat", LastModified: base}}, TrainingLogs: []models.TrainingLog{log}})
	assertTime := func(want *time.Time) {
		t.Helper()
		var sets []apiWorkoutSet
		getAPIRead(t, APIWorkoutsHandler, "/api/v1/workouts", userID, &sets)
		if len(sets) != 1 {
			t.Fatalf("sets=%+v", sets)
		}
		got := sets[0].CompletedAt
		if (got == nil) != (want == nil) || (got != nil && !got.Equal(*want)) {
			t.Fatalf("completed_at=%v want %v", got, want)
		}
		resp := postSync(t, token, SyncRequest{})
		if len(resp.TrainingLogs) != 1 {
			t.Fatalf("sync sets=%+v", resp.TrainingLogs)
		}
		got = resp.TrainingLogs[0].CompletedAt
		if (got == nil) != (want == nil) || (got != nil && !got.Equal(*want)) {
			t.Fatalf("sync completed_at=%v want %v", got, want)
		}
	}
	assertTime(&base)
	// An older client editing a completed row must not erase its timestamp.
	log.CompletedAt = nil
	log.LastModified = base.Add(time.Minute)
	// Simulate the actual old wire payload (without the newly added field).
	payload, err := json.Marshal(SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	if err != nil {
		t.Fatal(err)
	}
	var old map[string]any
	if err := json.Unmarshal(payload, &old); err != nil {
		t.Fatal(err)
	}
	delete(old["training_logs"].([]any)[0].(map[string]any), "completed_at")
	payload, err = json.Marshal(old)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/sync", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	middleware.AuthMiddleware(http.HandlerFunc(SyncHandler)).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("legacy sync: %d %s", rec.Code, rec.Body.String())
	}
	assertTime(&base)
	// Explicit null is different, including an offline uncheck followed by bulk completion.
	log.LastModified = base.Add(90 * time.Second)
	postSync(t, token, SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	assertTime(nil)
	log.CompletedAt = &base
	log.LastModified = base.Add(100 * time.Second)
	postSync(t, token, SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	assertTime(&base)
	log.CompletedAt = nil
	log.IsComplete = false
	log.LastModified = base.Add(2 * time.Minute)
	postSync(t, token, SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	assertTime(nil)
	// A legacy/bulk completion remains unknown.
	log.IsComplete = true
	log.LastModified = base.Add(3 * time.Minute)
	postSync(t, token, SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	assertTime(nil)
	again := base.Add(4 * time.Minute)
	log.CompletedAt = &again
	log.LastModified = again
	postSync(t, token, SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	assertTime(&again)
	log.Date = "2026-09-16"
	log.CompletedAt = nil
	log.LastModified = base.Add(5 * time.Minute)
	postSync(t, token, SyncRequest{TrainingLogs: []models.TrainingLog{log}})
	assertTime(nil)

	end := base.Add(30 * time.Minute)
	duration := 1800
	timer := models.WorkoutTime{ID: uuid.New(), Date: "2026-09-15", StartTime: &base, EndTime: &end, DurationSeconds: &duration, LastModified: end}
	postSync(t, token, SyncRequest{WorkoutTimes: []models.WorkoutTime{timer}})
	var timers []apiWorkoutTime
	getAPIRead(t, APIWorkoutTimesHandler, "/api/v1/workout-times?from=2026-09-15&to=2026-09-15", userID, &timers)
	if len(timers) != 1 || timers[0].DurationSeconds == nil || *timers[0].DurationSeconds != 1800 {
		t.Fatalf("timers=%+v", timers)
	}
	other, _ := createSyncTestUser(t)
	getAPIRead(t, APIWorkoutTimesHandler, "/api/v1/workout-times", other, &timers)
	if len(timers) != 0 {
		t.Fatal("timer leaked across users")
	}
	timer.IsDeleted = true
	timer.LastModified = end.Add(time.Minute)
	postSync(t, token, SyncRequest{WorkoutTimes: []models.WorkoutTime{timer}})
	getAPIRead(t, APIWorkoutTimesHandler, "/api/v1/workout-times", userID, &timers)
	if len(timers) != 1 || !timers[0].IsDeleted {
		t.Fatal("missing timer tombstone")
	}
}
