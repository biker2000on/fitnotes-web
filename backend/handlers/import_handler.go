package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

func parseFitNotesDate(dateStr string) (time.Time, bool) {
	if dateStr == "" {
		return time.Time{}, true
	}

	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err == nil {
		return parsedDate, true
	}

	if len(dateStr) > 10 {
		parsedDate, err = time.Parse("2006-01-02", dateStr[:10])
		if err == nil {
			return parsedDate, true
		}
	}

	return time.Time{}, false
}

func ImportFitNotesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// 1. Read Multipart File from request
	err = r.ParseMultipartForm(50 << 20) // Max 50 MB backup files
	if err != nil {
		http.Error(w, `{"error":"failed to parse multipart form"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"missing file field"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 2. Create Temp SQLite Database File
	tempFile, err := os.CreateTemp("", "fitnotes-import-*.sqlite")
	if err != nil {
		http.Error(w, `{"error":"failed to create temp file"}`, http.StatusInternalServerError)
		return
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		http.Error(w, `{"error":"failed to save uploaded file"}`, http.StatusInternalServerError)
		return
	}

	// 3. Open SQLite database using pure Go driver
	sqliteDB, err := sql.Open("sqlite", tempFile.Name())
	if err != nil {
		http.Error(w, `{"error":"failed to open uploaded database file: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	defer sqliteDB.Close()

	ctx := r.Context()
	pgPool := db.GetDB()

	// 4. Start PostgreSQL transaction for clean wipe-and-import
	tx, err := pgPool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"failed to start server database transaction"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// A. Delete existing data for this user to avoid conflicts
	tablesToDelete := []string{
		"settings",
		"workout_group_exercises",
		"workout_groups",
		"workout_comments",
		"training_logs",
		"body_weights",
		"plates",
		"barbells",
		"routines", // Cascades to sections, section_exercises, and sets
		"exercises",
		"categories",
	}

	for _, tbl := range tablesToDelete {
		_, err = tx.Exec(ctx, fmt.Sprintf("DELETE FROM %s WHERE user_id = $1", tbl), userID)
		if err != nil {
			http.Error(w, `{"error":"failed to wipe existing `+tbl+`: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}

	// B. Migrate Categories
	categoryMap := make(map[int64]uuid.UUID)
	categoryNameMap := make(map[int64]string)
	catRows, err := sqliteDB.Query("SELECT _id, name, colour, sort_order FROM Category")
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var oldID int64
			var name string
			var colour int
			var sortOrder int
			if err := catRows.Scan(&oldID, &name, &colour, &sortOrder); err != nil {
				http.Error(w, `{"error":"error scanning categories from backup: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			newID := uuid.New()
			categoryMap[oldID] = newID
			categoryNameMap[oldID] = name

			_, err = tx.Exec(ctx, `
				INSERT INTO categories (id, user_id, name, colour, sort_order, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, newID, userID, name, colour, sortOrder, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import categories: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// C. Migrate Exercises
	exerciseMap := make(map[int64]uuid.UUID)
	exRows, err := sqliteDB.Query("SELECT _id, name, category_id, exercise_type_id, notes, weight_increment, default_rest_time, weight_unit_id, is_favourite FROM exercise")
	if err == nil {
		defer exRows.Close()
		for exRows.Next() {
			var oldID int64
			var name string
			var categoryID sql.NullInt64
			var typeID int
			var notes sql.NullString
			var weightIncr sql.NullFloat64
			var restTime sql.NullInt64
			var weightUnit sql.NullInt64
			var isFav int

			if err := exRows.Scan(&oldID, &name, &categoryID, &typeID, &notes, &weightIncr, &restTime, &weightUnit, &isFav); err != nil {
				http.Error(w, `{"error":"error scanning exercises from backup: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newID := uuid.New()
			exerciseMap[oldID] = newID

			var finalCategoryID interface{} = nil
			if categoryID.Valid {
				if mappedCatUUID, ok := categoryMap[categoryID.Int64]; ok {
					finalCategoryID = mappedCatUUID
				}
			}

			notesVal := ""
			if notes.Valid {
				notesVal = notes.String
			}

			weightIncrVal := 2.5
			if weightIncr.Valid {
				weightIncrVal = weightIncr.Float64
			}

			restTimeVal := 90
			if restTime.Valid {
				restTimeVal = int(restTime.Int64)
			}

			weightUnitVal := 1
			if weightUnit.Valid {
				weightUnitVal = int(weightUnit.Int64)
			}

			// FitNotes backup exercise type IDs are already the canonical IDs used
			// by the web app. Preserve them so duration-only exercises remain time-based.
			webTypeID := 0
			switch typeID {
			case 0, 1, 2, 3, 4, 5, 6, 7:
				webTypeID = typeID
			default:
				webTypeID = 0
			}
			if categoryID.Valid && strings.EqualFold(categoryNameMap[categoryID.Int64], "Stretching") {
				webTypeID = 5
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO exercises (id, user_id, name, category_id, exercise_type_id, notes, weight_increment, default_rest_time, weight_unit_id, is_favourite, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			`, newID, userID, name, finalCategoryID, webTypeID, notesVal, weightIncrVal, restTimeVal, weightUnitVal, isFav == 1, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import exercises: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// D. Migrate Routines
	routineMap := make(map[int64]uuid.UUID)
	rtRows, err := sqliteDB.Query("SELECT _id, name, notes FROM Routine")
	if err == nil {
		defer rtRows.Close()
		for rtRows.Next() {
			var oldID int64
			var name string
			var notes sql.NullString

			if err := rtRows.Scan(&oldID, &name, &notes); err != nil {
				http.Error(w, `{"error":"error scanning routines: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			newID := uuid.New()
			routineMap[oldID] = newID

			notesVal := ""
			if notes.Valid {
				notesVal = notes.String
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO routines (id, user_id, name, notes, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, newID, userID, name, notesVal, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import routines: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// E. Migrate RoutineSections
	sectionMap := make(map[int64]uuid.UUID)
	secRows, err := sqliteDB.Query("SELECT _id, routine_id, name, sort_order FROM RoutineSection")
	if err == nil {
		defer secRows.Close()
		for secRows.Next() {
			var oldID, oldRtID int64
			var name string
			var sortOrder int

			if err := secRows.Scan(&oldID, &oldRtID, &name, &sortOrder); err != nil {
				http.Error(w, `{"error":"error scanning routine sections: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newRtID, ok := routineMap[oldRtID]
			if !ok {
				continue
			}

			newSecID := uuid.New()
			sectionMap[oldID] = newSecID

			_, err = tx.Exec(ctx, `
				INSERT INTO routine_sections (id, routine_id, name, sort_order, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, newSecID, newRtID, name, sortOrder, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import routine sections: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// F. Migrate RoutineSectionExercises
	sectionExMap := make(map[int64]uuid.UUID)
	secExRows, err := sqliteDB.Query("SELECT _id, routine_section_id, exercise_id, sort_order, populate_sets_type FROM RoutineSectionExercise")
	if err == nil {
		defer secExRows.Close()
		for secExRows.Next() {
			var oldID, oldSecID, oldExID int64
			var sortOrder, popType int

			if err := secExRows.Scan(&oldID, &oldSecID, &oldExID, &sortOrder, &popType); err != nil {
				http.Error(w, `{"error":"error scanning routine section exercises: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newSecID, ok1 := sectionMap[oldSecID]
			newExID, ok2 := exerciseMap[oldExID]
			if !ok1 || !ok2 {
				continue
			}

			newSecExID := uuid.New()
			sectionExMap[oldID] = newSecExID

			_, err = tx.Exec(ctx, `
				INSERT INTO routine_section_exercises (id, routine_section_id, exercise_id, sort_order, populate_sets_type, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, newSecExID, newSecID, newExID, sortOrder, popType, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import routine exercises: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// G. Migrate RoutineSectionExerciseSets
	sectionExSetMap := make(map[int64]uuid.UUID)
	secExSetRows, err := sqliteDB.Query("SELECT _id, routine_section_exercise_id, metric_weight, reps, sort_order, distance, duration_seconds, unit FROM RoutineSectionExerciseSet")
	if err == nil {
		defer secExSetRows.Close()
		for secExSetRows.Next() {
			var oldID, oldSecExID int64
			var weight sql.NullFloat64
			var reps sql.NullInt64
			var sortOrder int
			var distance sql.NullFloat64
			var duration sql.NullInt64
			var unit sql.NullInt64

			if err := secExSetRows.Scan(&oldID, &oldSecExID, &weight, &reps, &sortOrder, &distance, &duration, &unit); err != nil {
				http.Error(w, `{"error":"error scanning routine predefined sets: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newSecExID, ok := sectionExMap[oldSecExID]
			if !ok {
				continue
			}

			newSetID := uuid.New()
			sectionExSetMap[oldID] = newSetID

			var wVal interface{} = nil
			if weight.Valid {
				wVal = weight.Float64
			}
			var rVal interface{} = nil
			if reps.Valid {
				rVal = int(reps.Int64)
			}
			var dVal interface{} = nil
			if distance.Valid {
				dVal = distance.Float64
			}
			var durVal interface{} = nil
			if duration.Valid {
				durVal = int(duration.Int64)
			}
			var uVal interface{} = nil
			if unit.Valid {
				uVal = int(unit.Int64)
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO routine_section_exercise_sets (id, routine_section_exercise_id, metric_weight, reps, sort_order, distance, duration_seconds, unit, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`, newSetID, newSecExID, wVal, rVal, sortOrder, dVal, durVal, uVal, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import predefined sets: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// H. Migrate TrainingLogs
	logRows, err := sqliteDB.Query("SELECT _id, exercise_id, date, metric_weight, reps, unit, routine_section_exercise_set_id, is_personal_record, is_complete, distance, duration_seconds FROM training_log")
	if err == nil {
		defer logRows.Close()
		for logRows.Next() {
			var oldID, oldExID int64
			var dateStr string
			var weight sql.NullFloat64
			var reps sql.NullInt64
			var unit sql.NullInt64
			var oldSetID sql.NullInt64
			var isPR, isComplete int
			var distance sql.NullFloat64
			var duration sql.NullInt64

			if err := logRows.Scan(&oldID, &oldExID, &dateStr, &weight, &reps, &unit, &oldSetID, &isPR, &isComplete, &distance, &duration); err != nil {
				http.Error(w, `{"error":"error scanning training logs from backup: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newExID, ok := exerciseMap[oldExID]
			if !ok {
				continue
			}

			parsedDate, err := time.Parse("2006-01-02", dateStr)
			if err != nil {
				// Fallback to try splitting standard timestamps
				if len(dateStr) > 10 {
					parsedDate, err = time.Parse("2006-01-02", dateStr[:10])
				}
				if err != nil {
					continue // Ignore corrupted date formats
				}
			}

			newSetID := uuid.NullUUID{}
			if oldSetID.Valid {
				if mappedSetUUID, exists := sectionExSetMap[oldSetID.Int64]; exists {
					newSetID.UUID = mappedSetUUID
					newSetID.Valid = true
				}
			}

			var wVal interface{} = nil
			if weight.Valid {
				wVal = weight.Float64
			}
			var rVal interface{} = nil
			if reps.Valid {
				rVal = int(reps.Int64)
			}
			var uVal interface{} = nil
			if unit.Valid {
				uVal = int(unit.Int64)
			}
			var dVal interface{} = nil
			if distance.Valid {
				dVal = distance.Float64
			}
			var durVal interface{} = nil
			if duration.Valid {
				durVal = int(duration.Int64)
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO training_logs (id, user_id, exercise_id, date, metric_weight, reps, unit, routine_section_exercise_set_id, is_personal_record, is_complete, distance, duration_seconds, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			`, uuid.New(), userID, newExID, parsedDate, wVal, rVal, uVal, newSetID, isPR == 1, isComplete == 1, dVal, durVal, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import training logs: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// I. Migrate BodyWeights
	bwRows, err := sqliteDB.Query("SELECT date, body_weight_metric, body_fat, comments FROM BodyWeight")
	if err == nil {
		defer bwRows.Close()
		for bwRows.Next() {
			var dateStr string
			var weight float64
			var bodyFat sql.NullFloat64
			var comments sql.NullString

			if err := bwRows.Scan(&dateStr, &weight, &bodyFat, &comments); err != nil {
				http.Error(w, `{"error":"error scanning body weights from backup: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			parsedDate, err := time.Parse("2006-01-02", dateStr)
			if err != nil {
				if len(dateStr) > 10 {
					parsedDate, err = time.Parse("2006-01-02", dateStr[:10])
				}
				if err != nil {
					continue
				}
			}

			var fatVal interface{} = nil
			if bodyFat.Valid {
				fatVal = bodyFat.Float64
			}

			comVal := ""
			if comments.Valid {
				comVal = comments.String
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO body_weights (id, user_id, date, body_weight_metric, body_fat, comments, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, uuid.New(), userID, parsedDate, weight, fatVal, comVal, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import body weight logs: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// J. Migrate WorkoutComments
	cmtRows, err := sqliteDB.Query("SELECT date, comment FROM WorkoutComment")
	if err == nil {
		defer cmtRows.Close()
		for cmtRows.Next() {
			var dateStr string
			var comment string

			if err := cmtRows.Scan(&dateStr, &comment); err != nil {
				http.Error(w, `{"error":"error scanning comments from backup: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			parsedDate, err := time.Parse("2006-01-02", dateStr)
			if err != nil {
				if len(dateStr) > 10 {
					parsedDate, err = time.Parse("2006-01-02", dateStr[:10])
				}
				if err != nil {
					continue
				}
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO workout_comments (id, user_id, date, comment, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, uuid.New(), userID, parsedDate, comment, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import comments: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// K. Migrate WorkoutGroups (Supersets)
	groupMap := make(map[int64]uuid.UUID)
	wgRows, err := sqliteDB.Query("SELECT _id, name, date, colour, routine_section_id, auto_jump_enabled, rest_timer_auto_start_enabled FROM WorkoutGroup")
	if err == nil {
		defer wgRows.Close()
		for wgRows.Next() {
			var oldID int64
			var name, dateStr string
			var colour int
			var oldSecID sql.NullInt64
			var autoJump, restAuto int

			if err := wgRows.Scan(&oldID, &name, &dateStr, &colour, &oldSecID, &autoJump, &restAuto); err != nil {
				http.Error(w, `{"error":"error scanning workout groups: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newGroupID := uuid.New()
			groupMap[oldID] = newGroupID

			parsedDate, ok := parseFitNotesDate(dateStr)
			if !ok {
				continue
			}

			var newSecID interface{} = nil
			if oldSecID.Valid {
				if mappedSecUUID, exists := sectionMap[oldSecID.Int64]; exists {
					newSecID = mappedSecUUID
				}
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO workout_groups (id, user_id, name, date, colour, routine_section_id, auto_jump_enabled, rest_timer_auto_start_enabled, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`, newGroupID, userID, name, parsedDate, colour, newSecID, autoJump == 1, restAuto == 1, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import workout groups: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// L. Migrate WorkoutGroupExercises
	wgeRows, err := sqliteDB.Query("SELECT exercise_id, date, routine_section_id, workout_group_id FROM WorkoutGroupExercise")
	if err == nil {
		defer wgeRows.Close()
		for wgeRows.Next() {
			var oldExID, oldGroupID int64
			var dateStr string
			var oldSecID sql.NullInt64

			if err := wgeRows.Scan(&oldExID, &dateStr, &oldSecID, &oldGroupID); err != nil {
				http.Error(w, `{"error":"error scanning workout group exercises: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			newExID, ok1 := exerciseMap[oldExID]
			newGroupID, ok2 := groupMap[oldGroupID]
			if !ok1 || !ok2 {
				continue
			}

			parsedDate, ok := parseFitNotesDate(dateStr)
			if !ok {
				continue
			}

			var newSecID interface{} = nil
			if oldSecID.Valid {
				if mappedSecUUID, exists := sectionMap[oldSecID.Int64]; exists {
					newSecID = mappedSecUUID
				}
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO workout_group_exercises (id, user_id, exercise_id, date, routine_section_id, workout_group_id, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, uuid.New(), userID, newExID, parsedDate, newSecID, newGroupID, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import workout group exercises: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// M. Migrate Barbells
	barRows, err := sqliteDB.Query("SELECT weight, unit, exercise_id FROM Barbell")
	if err == nil {
		defer barRows.Close()
		for barRows.Next() {
			var weight float64
			var unit int
			var oldExID sql.NullInt64

			if err := barRows.Scan(&weight, &unit, &oldExID); err != nil {
				http.Error(w, `{"error":"error scanning barbells: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			var newExID interface{} = nil
			if oldExID.Valid {
				if mappedExUUID, exists := exerciseMap[oldExID.Int64]; exists {
					newExID = mappedExUUID
				}
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO barbells (id, user_id, weight, unit, exercise_id, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, uuid.New(), userID, weight, unit, newExID, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import barbells: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// N. Migrate Plates
	plateRows, err := sqliteDB.Query("SELECT weight, unit, count, enabled, colour, width_ratio, height_ratio FROM Plate")
	if err == nil {
		defer plateRows.Close()
		for plateRows.Next() {
			var weight, width, height float64
			var unit, count, enabled, colour int

			if err := plateRows.Scan(&weight, &unit, &count, &enabled, &colour, &width, &height); err != nil {
				http.Error(w, `{"error":"error scanning plates: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}

			_, err = tx.Exec(ctx, `
				INSERT INTO plates (id, user_id, weight, unit, count, enabled, colour, width_ratio, height_ratio, last_modified, is_deleted)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`, uuid.New(), userID, weight, unit, count, enabled == 1, colour, width, height, time.Now().UTC(), false)
			if err != nil {
				http.Error(w, `{"error":"failed to import plates: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
		}
	}

	// O. Migrate Settings
	setRows, err := sqliteDB.Query(`
		SELECT 
			metric, first_day_of_week, selected_navigation_item_id, weight_increment, body_weight_increment,
			body_weight_goal, body_weight_goal_weight, body_weight_show_in_workout_log, estimated_1rm_max_reps_to_include,
			estimated_1rm_max_apply_to_graph, track_personal_records, mark_sets_complete, auto_select_next_set, keep_screen_on,
			graph_show_points, graph_show_trend_line, graph_start_at_zero, rest_timer_seconds, rest_timer_vibrate,
			rest_timer_sound, rest_timer_volume, rest_timer_auto_start, calendar_detail_visible, calendar_category_dots_visible,
			calendar_navigation_bar_visible, calendar_history_category_dots_visible, calendar_history_category_names_visible,
			calendar_history_sets_visible, category_sort_order, category_show_colours, measurement_tracker_initial_load,
			measurement_show_in_workout_log, workout_graph_default_graph_type, workout_graph_default_time_period,
			analysis_breakdown_breakdown_type, analysis_breakdown_time_period, exercise_list_detail_type_id
		FROM settings LIMIT 1
	`)
	if err == nil {
		defer setRows.Close()
		if setRows.Next() {
			var metric, firstDay, selectedNav, weightIncr, bodyWeightIncr int
			var bodyWeightGoal int
			var bodyWeightGoalWeight float64
			var bodyWeightShowLog, est1RMMaxReps, est1RMGraph, trackPRs, markComplete, autoSelect, keepScreenOn int
			var graphShowPoints, graphShowTrend, graphStartZero, restTimerSecs, restVibrate, restSound, restVol, restAuto int
			var calDetail, calDots, calNav, calHistoryDots, calHistoryNames, calHistorySets, catSort, catColours int
			var measTrackerLoad, measShowLog, graphDefaultType, graphDefaultPeriod, analysisType, analysisPeriod, exListDetail int

			err = setRows.Scan(
				&metric, &firstDay, &selectedNav, &weightIncr, &bodyWeightIncr,
				&bodyWeightGoal, &bodyWeightGoalWeight, &bodyWeightShowLog, &est1RMMaxReps,
				&est1RMGraph, &trackPRs, &markComplete, &autoSelect, &keepScreenOn,
				&graphShowPoints, &graphShowTrend, &graphStartZero, &restTimerSecs, &restVibrate,
				&restSound, &restVol, &restAuto, &calDetail, &calDots, &calNav, &calHistoryDots,
				&calHistoryNames, &calHistorySets, &catSort, &catColours, &measTrackerLoad,
				&measShowLog, &graphDefaultType, &graphDefaultPeriod, &analysisType, &analysisPeriod, &exListDetail,
			)

			if err == nil {
				_, _ = tx.Exec(ctx, `
					INSERT INTO settings (
						user_id, metric, first_day_of_week, selected_navigation_item_id, weight_increment, body_weight_increment,
						body_weight_goal, body_weight_goal_weight, body_weight_show_in_workout_log, estimated_1rm_max_reps_to_include,
						estimated_1rm_max_apply_to_graph, track_personal_records, mark_sets_complete, auto_select_next_set, keep_screen_on,
						graph_show_points, graph_show_trend_line, graph_start_at_zero, rest_timer_seconds, rest_timer_vibrate,
						rest_timer_sound, rest_timer_volume, rest_timer_auto_start, calendar_detail_visible, calendar_category_dots_visible,
						calendar_navigation_bar_visible, calendar_history_category_dots_visible, calendar_history_category_names_visible,
						calendar_history_sets_visible, category_sort_order, category_show_colours, measurement_tracker_initial_load,
						measurement_show_in_workout_log, workout_graph_default_graph_type, workout_graph_default_time_period,
						analysis_breakdown_breakdown_type, analysis_breakdown_time_period, exercise_list_detail_type_id,
						workout_timer_auto_start_enabled, workout_timer_auto_stop_enabled, home_screen_limit_type_id,
						home_screen_limit_value, home_screen_category_visibility_id, home_screen_skip_empty_dates, app_theme_id, last_modified
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
						$26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, false, false, 1, 0, 1, false, 1, $39
					)
				`, userID, metric == 1, firstDay, selectedNav, weightIncr, bodyWeightIncr, bodyWeightGoal == 1, bodyWeightGoalWeight,
					bodyWeightShowLog == 1, est1RMMaxReps, est1RMGraph == 1, trackPRs == 1, markComplete == 1, autoSelect == 1, keepScreenOn == 1,
					graphShowPoints == 1, graphShowTrend == 1, graphStartZero == 1, restTimerSecs, restVibrate == 1, restSound == 1, restVol, restAuto == 1,
					calDetail == 1, calDots == 1, calNav == 1, calHistoryDots == 1, calHistoryNames == 1, calHistorySets == 1, catSort, catColours == 1,
					measTrackerLoad == 1, measShowLog == 1, graphDefaultType, graphDefaultPeriod, analysisType, analysisPeriod, exListDetail, time.Now().UTC())
			}
		}
	}

	// 5. Commit PostgreSQL transaction
	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"failed to commit imported data: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"success":true,"message":"Historical database imported successfully!"}`))
}
