package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/google/uuid"
)

type apiExercise struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Category         *string   `json:"category"`
	ExerciseTypeID   int       `json:"exercise_type_id"`
	Notes            *string   `json:"notes"`
	Equipment        *string   `json:"equipment"`
	PrimaryMuscles   *string   `json:"primary_muscles"`
	SecondaryMuscles *string   `json:"secondary_muscles"`
	LastModified     time.Time `json:"last_modified"`
}

type apiWorkoutSet struct {
	ID                          uuid.UUID  `json:"id"`
	Date                        string     `json:"date"`
	ExerciseID                  uuid.UUID  `json:"exercise_id"`
	Exercise                    string     `json:"exercise"`
	Category                    *string    `json:"category"`
	MetricWeight                *float64   `json:"metric_weight"`
	Reps                        *int       `json:"reps"`
	Unit                        *int       `json:"unit"`
	RPE                         *float64   `json:"rpe"`
	RIR                         *float64   `json:"rir"`
	SetType                     string     `json:"set_type"`
	IsPersonalRecord            bool       `json:"is_personal_record"`
	IsComplete                  bool       `json:"is_complete"`
	Distance                    *float64   `json:"distance"`
	DurationSeconds             *int       `json:"duration_seconds"`
	Comment                     *string    `json:"comment"`
	RoutineSectionExerciseSetID *uuid.UUID `json:"routine_section_exercise_set_id"`
	LastModified                time.Time  `json:"last_modified"`
}

type apiWorkoutGroup struct {
	ID           uuid.UUID   `json:"id"`
	Name         string      `json:"name"`
	Date         string      `json:"date"`
	Colour       int         `json:"colour"`
	ExerciseIDs  []uuid.UUID `json:"exercise_ids"`
	LastModified time.Time   `json:"last_modified"`
}

type apiWorkoutRoutine struct {
	ID               uuid.UUID  `json:"id"`
	Date             string     `json:"date"`
	RoutineID        uuid.UUID  `json:"routine_id"`
	RoutineName      string     `json:"routine_name"`
	RoutineSectionID *uuid.UUID `json:"routine_section_id"`
	SectionName      *string    `json:"section_name"`
	LastModified     time.Time  `json:"last_modified"`
}

type apiBodyWeight struct {
	ID               uuid.UUID  `json:"id"`
	Date             string     `json:"date"`
	MeasuredAt       *time.Time `json:"measured_at"`
	BodyWeightMetric float64    `json:"body_weight_metric"`
	BodyFat          *float64   `json:"body_fat"`
	Comments         *string    `json:"comments"`
	LastModified     time.Time  `json:"last_modified"`
}

func apiPagination(r *http.Request) (int, int) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit < 1 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

func validDateFilter(value string) bool {
	if value == "" {
		return true
	}
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}

func writeAPIData(w http.ResponseWriter, data any, limit, offset, count int) {
	_ = json.NewEncoder(w).Encode(map[string]any{
		"data": data,
		"pagination": map[string]int{
			"limit":  limit,
			"offset": offset,
			"count":  count,
		},
	})
}

func APIInfoHandler(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(map[string]any{
		"name":      "FitNotes read-only API",
		"version":   "v1",
		"resources": []string{"/api/v1/exercises", "/api/v1/workouts", "/api/v1/body-weights", "/api/v1/workout-groups", "/api/v1/workout-routines"},
	})
}

func APIExercisesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	limit, offset := apiPagination(r)
	rows, err := db.GetDB().Query(r.Context(), `
		SELECT e.id, e.name, c.name, e.exercise_type_id, e.notes, e.equipment,
		       e.primary_muscles, e.secondary_muscles, e.last_modified
		FROM exercises e
		LEFT JOIN categories c ON c.id = e.category_id AND c.user_id = e.user_id AND c.is_deleted = FALSE
		WHERE e.user_id = $1 AND e.is_deleted = FALSE
		ORDER BY e.name, e.id
		LIMIT $2 OFFSET $3`,
		userID, limit, offset,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to query exercises"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]apiExercise, 0)
	for rows.Next() {
		var item apiExercise
		if err := rows.Scan(&item.ID, &item.Name, &item.Category, &item.ExerciseTypeID, &item.Notes, &item.Equipment, &item.PrimaryMuscles, &item.SecondaryMuscles, &item.LastModified); err != nil {
			http.Error(w, `{"error":"failed to read exercises"}`, http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to read exercises"}`, http.StatusInternalServerError)
		return
	}
	writeAPIData(w, items, limit, offset, len(items))
}

func APIWorkoutsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	from, to := strings.TrimSpace(r.URL.Query().Get("from")), strings.TrimSpace(r.URL.Query().Get("to"))
	if !validDateFilter(from) || !validDateFilter(to) {
		http.Error(w, `{"error":"from and to must use YYYY-MM-DD"}`, http.StatusBadRequest)
		return
	}
	exerciseID := strings.TrimSpace(r.URL.Query().Get("exercise_id"))
	var exerciseFilter *uuid.UUID
	if exerciseID != "" {
		parsed, err := uuid.Parse(exerciseID)
		if err != nil {
			http.Error(w, `{"error":"exercise_id must be a UUID"}`, http.StatusBadRequest)
			return
		}
		exerciseFilter = &parsed
	}
	limit, offset := apiPagination(r)
	rows, err := db.GetDB().Query(r.Context(), `
		SELECT tl.id, to_char(tl.date, 'YYYY-MM-DD'), tl.exercise_id, e.name, c.name,
		       tl.metric_weight, tl.reps, tl.unit, tl.rpe, tl.rir, tl.set_type,
		       tl.is_personal_record, tl.is_complete, tl.distance, tl.duration_seconds,
		       tl.comment, tl.routine_section_exercise_set_id, tl.last_modified
		FROM training_logs tl
		JOIN exercises e ON e.id = tl.exercise_id AND e.user_id = tl.user_id
		LEFT JOIN categories c ON c.id = e.category_id AND c.user_id = tl.user_id AND c.is_deleted = FALSE
		WHERE tl.user_id = $1
		  AND tl.is_deleted = FALSE
		  AND ($2::date IS NULL OR tl.date >= $2::date)
		  AND ($3::date IS NULL OR tl.date <= $3::date)
		  AND ($4::uuid IS NULL OR tl.exercise_id = $4::uuid)
		ORDER BY tl.date DESC, tl.last_modified DESC, tl.id
		LIMIT $5 OFFSET $6`,
		userID, nilIfEmpty(from), nilIfEmpty(to), exerciseFilter, limit, offset,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to query workouts"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]apiWorkoutSet, 0)
	for rows.Next() {
		var item apiWorkoutSet
		if err := rows.Scan(
			&item.ID, &item.Date, &item.ExerciseID, &item.Exercise, &item.Category,
			&item.MetricWeight, &item.Reps, &item.Unit, &item.RPE, &item.RIR, &item.SetType,
			&item.IsPersonalRecord, &item.IsComplete, &item.Distance, &item.DurationSeconds,
			&item.Comment, &item.RoutineSectionExerciseSetID, &item.LastModified,
		); err != nil {
			http.Error(w, `{"error":"failed to read workouts"}`, http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to read workouts"}`, http.StatusInternalServerError)
		return
	}
	writeAPIData(w, items, limit, offset, len(items))
}

func APIBodyWeightsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	from, to := strings.TrimSpace(r.URL.Query().Get("from")), strings.TrimSpace(r.URL.Query().Get("to"))
	if !validDateFilter(from) || !validDateFilter(to) {
		http.Error(w, `{"error":"from and to must use YYYY-MM-DD"}`, http.StatusBadRequest)
		return
	}
	limit, offset := apiPagination(r)
	rows, err := db.GetDB().Query(r.Context(), `
		SELECT id, to_char(date, 'YYYY-MM-DD'), measured_at, body_weight_metric, body_fat, comments, last_modified
		FROM body_weights
		WHERE user_id = $1
		  AND is_deleted = FALSE
		  AND ($2::date IS NULL OR date >= $2::date)
		  AND ($3::date IS NULL OR date <= $3::date)
		ORDER BY date DESC, measured_at DESC NULLS LAST, id
		LIMIT $4 OFFSET $5`,
		userID, nilIfEmpty(from), nilIfEmpty(to), limit, offset,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to query body weights"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]apiBodyWeight, 0)
	for rows.Next() {
		var item apiBodyWeight
		if err := rows.Scan(&item.ID, &item.Date, &item.MeasuredAt, &item.BodyWeightMetric, &item.BodyFat, &item.Comments, &item.LastModified); err != nil {
			http.Error(w, `{"error":"failed to read body weights"}`, http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to read body weights"}`, http.StatusInternalServerError)
		return
	}
	writeAPIData(w, items, limit, offset, len(items))
}

func APIWorkoutGroupsHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	from, to := strings.TrimSpace(r.URL.Query().Get("from")), strings.TrimSpace(r.URL.Query().Get("to"))
	if !validDateFilter(from) || !validDateFilter(to) {
		http.Error(w, `{"error":"from and to must use YYYY-MM-DD"}`, http.StatusBadRequest)
		return
	}
	limit, offset := apiPagination(r)
	// Routine-template supersets are stored with the zero-time sentinel date
	// (0001-01-01); only logged-workout groups carry a real calendar date.
	rows, err := db.GetDB().Query(r.Context(), `
		SELECT wg.id, wg.name, to_char(wg.date, 'YYYY-MM-DD'), wg.colour,
		       COALESCE(array_agg(wge.exercise_id ORDER BY wge.id) FILTER (WHERE wge.id IS NOT NULL), '{}'::uuid[]),
		       wg.last_modified
		FROM workout_groups wg
		LEFT JOIN workout_group_exercises wge
		  ON wge.workout_group_id = wg.id AND wge.user_id = wg.user_id AND wge.is_deleted = FALSE
		WHERE wg.user_id = $1
		  AND wg.is_deleted = FALSE
		  AND wg.date > '0001-01-01'::date
		  AND ($2::date IS NULL OR wg.date >= $2::date)
		  AND ($3::date IS NULL OR wg.date <= $3::date)
		GROUP BY wg.id
		ORDER BY wg.date DESC, wg.last_modified DESC, wg.id
		LIMIT $4 OFFSET $5`,
		userID, nilIfEmpty(from), nilIfEmpty(to), limit, offset,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to query workout groups"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]apiWorkoutGroup, 0)
	for rows.Next() {
		var item apiWorkoutGroup
		if err := rows.Scan(&item.ID, &item.Name, &item.Date, &item.Colour, &item.ExerciseIDs, &item.LastModified); err != nil {
			http.Error(w, `{"error":"failed to read workout groups"}`, http.StatusInternalServerError)
			return
		}
		if item.ExerciseIDs == nil {
			item.ExerciseIDs = []uuid.UUID{}
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to read workout groups"}`, http.StatusInternalServerError)
		return
	}
	writeAPIData(w, items, limit, offset, len(items))
}

func APIWorkoutRoutinesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	from, to := strings.TrimSpace(r.URL.Query().Get("from")), strings.TrimSpace(r.URL.Query().Get("to"))
	if !validDateFilter(from) || !validDateFilter(to) {
		http.Error(w, `{"error":"from and to must use YYYY-MM-DD"}`, http.StatusBadRequest)
		return
	}
	limit, offset := apiPagination(r)
	rows, err := db.GetDB().Query(r.Context(), `
		SELECT wr.id, to_char(wr.date, 'YYYY-MM-DD'), wr.routine_id, rt.name,
		       wr.routine_section_id, rs.name, wr.last_modified
		FROM workout_routines wr
		JOIN routines rt ON rt.id = wr.routine_id AND rt.user_id = wr.user_id
		LEFT JOIN routine_sections rs ON rs.id = wr.routine_section_id AND rs.routine_id = wr.routine_id
		WHERE wr.user_id = $1
		  AND wr.is_deleted = FALSE
		  AND ($2::date IS NULL OR wr.date >= $2::date)
		  AND ($3::date IS NULL OR wr.date <= $3::date)
		ORDER BY wr.date DESC, wr.last_modified DESC, wr.id
		LIMIT $4 OFFSET $5`,
		userID, nilIfEmpty(from), nilIfEmpty(to), limit, offset,
	)
	if err != nil {
		http.Error(w, `{"error":"failed to query workout routines"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]apiWorkoutRoutine, 0)
	for rows.Next() {
		var item apiWorkoutRoutine
		if err := rows.Scan(&item.ID, &item.Date, &item.RoutineID, &item.RoutineName, &item.RoutineSectionID, &item.SectionName, &item.LastModified); err != nil {
			http.Error(w, `{"error":"failed to read workout routines"}`, http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, `{"error":"failed to read workout routines"}`, http.StatusInternalServerError)
		return
	}
	writeAPIData(w, items, limit, offset, len(items))
}

func nilIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}
