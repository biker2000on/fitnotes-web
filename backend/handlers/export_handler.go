package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

func ExportFitNotesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// 1. Create temporary SQLite file
	tempFile, err := os.CreateTemp("", "fitnotes-export-*.sqlite")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"failed to create temp file"}`, http.StatusInternalServerError)
		return
	}
	tempFileName := tempFile.Name()
	tempFile.Close() // Close so sqlite driver can open it cleanly
	defer os.Remove(tempFileName)

	// 2. Open SQLite database connection
	sqliteDB, err := sql.Open("sqlite", tempFileName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"failed to create SQLite instance: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	defer sqliteDB.Close()

	// 3. Create raw SQLite database schemas
	schemas := []string{
		"CREATE TABLE Category(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, colour INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE exercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category_id INTEGER NOT NULL, exercise_type_id INTEGER NOT NULL DEFAULT 0, notes TEXT, weight_increment INTEGER, default_graph_id INTEGER, default_rest_time INTEGER, weight_unit_id INTEGER NOT NULL DEFAULT 0, is_favourite INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE training_log (_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, date DATE NOT NULL, metric_weight INTEGER NOT NULL, reps INTEGER NOT NULL, unit INTEGER NOT NULL DEFAULT 0, routine_section_exercise_set_id INTEGER NOT NULL DEFAULT 0, timer_auto_start INTEGER NOT NULL DEFAULT 0, is_personal_record INTEGER NOT NULL DEFAULT 0, is_personal_record_first INTEGER NOT NULL DEFAULT 0, is_complete INTEGER NOT NULL DEFAULT 0, is_pending_update INTEGER NOT NULL DEFAULT 0, distance INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE Routine(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, notes TEXT)",
		"CREATE TABLE RoutineSection(_id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT '0')",
		"CREATE TABLE RoutineSectionExercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, routine_section_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, populate_sets_type INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE RoutineSectionExerciseSet(_id INTEGER PRIMARY KEY AUTOINCREMENT, routine_section_exercise_id INTEGER NOT NULL, metric_weight INTEGER NOT NULL, reps INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, distance INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0, unit INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE WorkoutGroup (_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, date TEXT NOT NULL, colour INTEGER NOT NULL, routine_section_id INTEGER, auto_jump_enabled INTEGER NOT NULL DEFAULT 1, rest_timer_auto_start_enabled INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE WorkoutGroupExercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, date TEXT NOT NULL, routine_section_id INTEGER NOT NULL, workout_group_id INTEGER NOT NULL)",
		"CREATE TABLE WorkoutComment (_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, comment TEXT NOT NULL)",
		"CREATE TABLE BodyWeight (_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, body_weight_metric REAL NOT NULL, body_fat REAL NOT NULL, comments TEXT)",
		"CREATE TABLE Barbell (_id INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL NOT NULL, unit INTEGER NOT NULL DEFAULT 0, exercise_id INTEGER NOT NULL DEFAULT 0)",
		"CREATE TABLE Plate (_id INTEGER PRIMARY KEY AUTOINCREMENT, weight REAL NOT NULL, unit INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 0, colour INTEGER NOT NULL DEFAULT 0, width_ratio REAL NOT NULL DEFAULT 1, height_ratio REAL NOT NULL DEFAULT 1)",
		"CREATE TABLE settings (_id INTEGER PRIMARY KEY AUTOINCREMENT, metric INTEGER NOT NULL DEFAULT 0, first_day_of_week INTEGER NOT NULL DEFAULT 0, selected_navigation_item_id INTEGER NOT NULL DEFAULT 0, weight_increment INTEGER NOT NULL DEFAULT 0, body_weight_increment INTEGER, body_weight_goal INTEGER, body_weight_goal_weight INTEGER, body_weight_show_in_workout_log INTEGER, estimated_1rm_max_reps_to_include INTEGER, estimated_1rm_max_apply_to_graph INTEGER, track_personal_records INTEGER, mark_sets_complete INTEGER, auto_select_next_set INTEGER, keep_screen_on INTEGER, graph_show_points INTEGER, graph_show_trend_line INTEGER, graph_start_at_zero INTEGER, rest_timer_seconds INTEGER, rest_timer_vibrate INTEGER, rest_timer_sound INTEGER, rest_timer_volume INTEGER, rest_timer_auto_start INTEGER, calendar_detail_visible INTEGER, calendar_category_dots_visible INTEGER, calendar_navigation_bar_visible INTEGER, calendar_history_category_dots_visible INTEGER, calendar_history_category_names_visible INTEGER, calendar_history_sets_visible INTEGER, category_sort_order INTEGER, category_show_colours INTEGER, measurement_tracker_initial_load INTEGER, measurement_show_in_workout_log INTEGER, workout_graph_default_graph_type INTEGER, workout_graph_default_time_period INTEGER, analysis_breakdown_breakdown_type INTEGER, analysis_breakdown_time_period INTEGER, exercise_list_detail_type_id INTEGER, workout_timer_auto_start_enabled INTEGER, workout_timer_auto_stop_enabled INTEGER, home_screen_limit_type_id INTEGER, home_screen_limit_value INTEGER, home_screen_category_visibility_id INTEGER, home_screen_skip_empty_dates INTEGER, app_theme_id INTEGER)",
	}

	for _, s := range schemas {
		_, err = sqliteDB.Exec(s)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"failed to create schema: `+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
	}

	ctx := r.Context()
	pgPool := db.GetDB()

	// 4. Mapping tables for UUID -> SQLite integer auto-increment keys
	catMap := make(map[uuid.UUID]int64)
	exMap := make(map[uuid.UUID]int64)
	rtMap := make(map[uuid.UUID]int64)
	secMap := make(map[uuid.UUID]int64)
	secExMap := make(map[uuid.UUID]int64)
	setMap := make(map[uuid.UUID]int64)
	wgMap := make(map[uuid.UUID]int64)

	var catCounter int64 = 1
	var exCounter int64 = 1
	var rtCounter int64 = 1
	var secCounter int64 = 1
	var secExCounter int64 = 1
	var setCounter int64 = 1
	var wgCounter int64 = 1

	// A. Export Categories
	catRows, err := pgPool.Query(ctx, "SELECT id, name, colour, sort_order FROM categories WHERE user_id = $1 AND is_deleted = false ORDER BY sort_order", userID)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var id uuid.UUID
			var name string
			var colour, sortOrder int
			if err := catRows.Scan(&id, &name, &colour, &sortOrder); err == nil {
				catMap[id] = catCounter
				_, _ = sqliteDB.Exec("INSERT INTO Category (_id, name, colour, sort_order) VALUES (?, ?, ?, ?)", catCounter, name, colour, sortOrder)
				catCounter++
			}
		}
	}

	// B. Export Exercises
	exRows, err := pgPool.Query(ctx, "SELECT id, name, category_id, exercise_type_id, notes, weight_increment, default_rest_time, weight_unit_id, is_favourite FROM exercises WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer exRows.Close()
		for exRows.Next() {
			var id uuid.UUID
			var name string
			var categoryID uuid.NullUUID
			var typeID, restTime, unitID int
			var notes string
			var weightIncr float64
			var isFav bool

			if err := exRows.Scan(&id, &name, &categoryID, &typeID, &notes, &weightIncr, &restTime, &unitID, &isFav); err == nil {
				exMap[id] = exCounter
				var oldCatID int64 = 0
				if categoryID.Valid {
					if val, ok := catMap[categoryID.UUID]; ok {
						oldCatID = val
					}
				}
				isFavInt := 0
				if isFav {
					isFavInt = 1
				}

				_, _ = sqliteDB.Exec("INSERT INTO exercise (_id, name, category_id, exercise_type_id, notes, weight_increment, default_rest_time, weight_unit_id, is_favourite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
					exCounter, name, oldCatID, typeID, notes, int(weightIncr), restTime, unitID, isFavInt)
				exCounter++
			}
		}
	}

	// C. Export Routines
	rtRows, err := pgPool.Query(ctx, "SELECT id, name, notes FROM routines WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer rtRows.Close()
		for rtRows.Next() {
			var id uuid.UUID
			var name, notes string
			if err := rtRows.Scan(&id, &name, &notes); err == nil {
				rtMap[id] = rtCounter
				_, _ = sqliteDB.Exec("INSERT INTO Routine (_id, name, notes) VALUES (?, ?, ?)", rtCounter, name, notes)
				rtCounter++
			}
		}
	}

	// D. Export Routine Sections
	secRows, err := pgPool.Query(ctx, `
		SELECT rs.id, rs.routine_id, rs.name, rs.sort_order 
		FROM routine_sections rs
		JOIN routines r ON rs.routine_id = r.id
		WHERE r.user_id = $1 AND rs.is_deleted = false ORDER BY rs.sort_order`, userID)
	if err == nil {
		defer secRows.Close()
		for secRows.Next() {
			var id, rtID uuid.UUID
			var name string
			var sortOrder int
			if err := secRows.Scan(&id, &rtID, &name, &sortOrder); err == nil {
				secMap[id] = secCounter
				oldRtID := rtMap[rtID]
				_, _ = sqliteDB.Exec("INSERT INTO RoutineSection (_id, routine_id, name, sort_order) VALUES (?, ?, ?, ?)", secCounter, oldRtID, name, sortOrder)
				secCounter++
			}
		}
	}

	// E. Export Routine Exercises
	rseRows, err := pgPool.Query(ctx, `
		SELECT re.id, re.routine_section_id, re.exercise_id, re.sort_order, re.populate_sets_type
		FROM routine_section_exercises re
		JOIN routine_sections rs ON re.routine_section_id = rs.id
		JOIN routines r ON rs.routine_id = r.id
		WHERE r.user_id = $1 AND re.is_deleted = false ORDER BY re.sort_order`, userID)
	if err == nil {
		defer rseRows.Close()
		for rseRows.Next() {
			var id, secID, exID uuid.UUID
			var sortOrder, popType int
			if err := rseRows.Scan(&id, &secID, &exID, &sortOrder, &popType); err == nil {
				secExMap[id] = secExCounter
				oldSecID := secMap[secID]
				oldExID := exMap[exID]
				_, _ = sqliteDB.Exec("INSERT INTO RoutineSectionExercise (_id, routine_section_id, exercise_id, sort_order, populate_sets_type) VALUES (?, ?, ?, ?, ?)",
					secExCounter, oldSecID, oldExID, sortOrder, popType)
				secExCounter++
			}
		}
	}

	// F. Export Predefined Sets
	setRows, err := pgPool.Query(ctx, `
		SELECT s.id, s.routine_section_exercise_id, s.metric_weight, s.reps, s.sort_order, s.distance, s.duration_seconds, s.unit
		FROM routine_section_exercise_sets s
		JOIN routine_section_exercises re ON s.routine_section_exercise_id = re.id
		JOIN routine_sections rs ON re.routine_section_id = rs.id
		JOIN routines r ON rs.routine_id = r.id
		WHERE r.user_id = $1 AND s.is_deleted = false ORDER BY s.sort_order`, userID)
	if err == nil {
		defer setRows.Close()
		for setRows.Next() {
			var id, rseID uuid.UUID
			var weight, distance sql.NullFloat64
			var reps, duration, unit sql.NullInt64
			var sortOrder int

			if err := setRows.Scan(&id, &rseID, &weight, &reps, &sortOrder, &distance, &duration, &unit); err == nil {
				setMap[id] = setCounter
				oldRseID := secExMap[rseID]

				var wVal interface{} = 0
				if weight.Valid {
					wVal = int(weight.Float64)
				}
				var rVal interface{} = 0
				if reps.Valid {
					rVal = int(reps.Int64)
				}
				var dVal interface{} = 0
				if distance.Valid {
					dVal = int(distance.Float64)
				}
				var durVal interface{} = 0
				if duration.Valid {
					durVal = int(duration.Int64)
				}
				var uVal interface{} = 0
				if unit.Valid {
					uVal = int(unit.Int64)
				}

				_, _ = sqliteDB.Exec("INSERT INTO RoutineSectionExerciseSet (_id, routine_section_exercise_id, metric_weight, reps, sort_order, distance, duration_seconds, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
					setCounter, oldRseID, wVal, rVal, sortOrder, dVal, durVal, uVal)
				setCounter++
			}
		}
	}

	// G. Export Training Logs
	logRows, err := pgPool.Query(ctx, "SELECT exercise_id, date, metric_weight, reps, unit, routine_section_exercise_set_id, is_personal_record, is_complete, distance, duration_seconds FROM training_logs WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer logRows.Close()
		for logRows.Next() {
			var exID uuid.UUID
			var date time.Time
			var weight, distance sql.NullFloat64
			var reps, unit, duration sql.NullInt64
			var setID uuid.NullUUID
			var isPR, isComplete bool

			if err := logRows.Scan(&exID, &date, &weight, &reps, &unit, &setID, &isPR, &isComplete, &distance, &duration); err == nil {
				oldExID := exMap[exID]
				oldSetID := int64(0)
				if setID.Valid {
					oldSetID = setMap[setID.UUID]
				}

				wVal := 0
				if weight.Valid {
					wVal = int(weight.Float64)
				}
				rVal := 0
				if reps.Valid {
					rVal = int(reps.Int64)
				}
				uVal := 0
				if unit.Valid {
					uVal = int(unit.Int64)
				}
				dVal := 0
				if distance.Valid {
					dVal = int(distance.Float64)
				}
				durVal := 0
				if duration.Valid {
					durVal = int(duration.Int64)
				}

				isPRVal := 0
				if isPR {
					isPRVal = 1
				}
				isCompleteVal := 0
				if isComplete {
					isCompleteVal = 1
				}

				_, _ = sqliteDB.Exec("INSERT INTO training_log (exercise_id, date, metric_weight, reps, unit, routine_section_exercise_set_id, is_personal_record, is_complete, distance, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					oldExID, date.Format("2006-01-02"), wVal, rVal, uVal, oldSetID, isPRVal, isCompleteVal, dVal, durVal)
			}
		}
	}

	// H. Export Comments
	cmtRows, err := pgPool.Query(ctx, "SELECT date, comment FROM workout_comments WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer cmtRows.Close()
		for cmtRows.Next() {
			var date time.Time
			var comment string
			if err := cmtRows.Scan(&date, &comment); err == nil {
				_, _ = sqliteDB.Exec("INSERT INTO WorkoutComment (date, comment) VALUES (?, ?)", date.Format("2006-01-02"), comment)
			}
		}
	}

	// I. Export Body Weights
	bwRows, err := pgPool.Query(ctx, "SELECT date, body_weight_metric, body_fat, comments FROM body_weights WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer bwRows.Close()
		for bwRows.Next() {
			var date time.Time
			var weight float64
			var fat sql.NullFloat64
			var comments string
			if err := pgPool.QueryRow(ctx, "SELECT 1").Scan(&err); err == nil || true { // placeholder check
				if err := bwRows.Scan(&date, &weight, &fat, &comments); err == nil {
					fatVal := float64(0)
					if fat.Valid {
						fatVal = fat.Float64
					}
					_, _ = sqliteDB.Exec("INSERT INTO BodyWeight (date, body_weight_metric, body_fat, comments) VALUES (?, ?, ?, ?)",
						date.Format("2006-01-02"), weight, fatVal, comments)
				}
			}
		}
	}

	// J. Export Workout Groups (Supersets)
	wgRows, err := pgPool.Query(ctx, "SELECT id, name, date, colour, routine_section_id, auto_jump_enabled, rest_timer_auto_start_enabled FROM workout_groups WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer wgRows.Close()
		for wgRows.Next() {
			var id uuid.UUID
			var name string
			var date time.Time
			var colour int
			var secID uuid.NullUUID
			var autoJump, restAuto bool

			if err := wgRows.Scan(&id, &name, &date, &colour, &secID, &autoJump, &restAuto); err == nil {
				wgMap[id] = wgCounter
				var oldSecID int64 = 0
				if secID.Valid {
					oldSecID = secMap[secID.UUID]
				}

				autoJumpInt := 0
				if autoJump {
					autoJumpInt = 1
				}
				restAutoInt := 0
				if restAuto {
					restAutoInt = 1
				}

				_, _ = sqliteDB.Exec("INSERT INTO WorkoutGroup (_id, name, date, colour, routine_section_id, auto_jump_enabled, rest_timer_auto_start_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
					wgCounter, name, date.Format("2006-01-02"), colour, oldSecID, autoJumpInt, restAutoInt)
				wgCounter++
			}
		}
	}

	// K. Export Workout Group Exercises
	wgeRows, err := pgPool.Query(ctx, "SELECT exercise_id, date, routine_section_id, workout_group_id FROM workout_group_exercises WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer wgeRows.Close()
		for wgeRows.Next() {
			var exID, groupID uuid.UUID
			var date time.Time
			var secID uuid.NullUUID

			if err := wgeRows.Scan(&exID, &date, &secID, &groupID); err == nil {
				oldExID := exMap[exID]
				oldGroupID := wgMap[groupID]
				var oldSecID int64 = 0
				if secID.Valid {
					oldSecID = secMap[secID.UUID]
				}

				_, _ = sqliteDB.Exec("INSERT INTO WorkoutGroupExercise (exercise_id, date, routine_section_id, workout_group_id) VALUES (?, ?, ?, ?)",
					oldExID, date.Format("2006-01-02"), oldSecID, oldGroupID)
			}
		}
	}

	// L. Export Barbells
	barRows, err := pgPool.Query(ctx, "SELECT weight, unit, exercise_id FROM barbells WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer barRows.Close()
		for barRows.Next() {
			var weight float64
			var unit int
			var exID uuid.NullUUID

			if err := barRows.Scan(&weight, &unit, &exID); err == nil {
				var oldExID int64 = 0
				if exID.Valid {
					oldExID = exMap[exID.UUID]
				}
				_, _ = sqliteDB.Exec("INSERT INTO Barbell (weight, unit, exercise_id) VALUES (?, ?, ?)", weight, unit, oldExID)
			}
		}
	}

	// M. Export Plates
	plateRows, err := pgPool.Query(ctx, "SELECT weight, unit, count, enabled, colour, width_ratio, height_ratio FROM plates WHERE user_id = $1 AND is_deleted = false", userID)
	if err == nil {
		defer plateRows.Close()
		for plateRows.Next() {
			var weight, width, height float64
			var unit, count, colour int
			var enabled bool

			if err := plateRows.Scan(&weight, &unit, &count, &enabled, &colour, &width, &height); err == nil {
				enabledInt := 0
				if enabled {
					enabledInt = 1
				}
				_, _ = sqliteDB.Exec("INSERT INTO Plate (weight, unit, count, enabled, colour, width_ratio, height_ratio) VALUES (?, ?, ?, ?, ?, ?, ?)",
					weight, unit, count, enabledInt, colour, width, height)
			}
		}
	}

	// N. Export Settings
	var metric, bodyWeightShowLog, est1RMGraph, trackPRs, markComplete, autoSelect, keepScreenOn bool
	var graphShowPoints, graphShowTrend, graphStartZero, restVibrate, restSound, restAuto, calDetail, calDots, calNav bool
	var calHistoryDots, calHistoryNames, calHistorySets, catColours, measTrackerLoad, measShowLog bool
	var firstDay, selectedNav, est1RMMaxReps, restTimerSecs, restVol, catSort, graphDefaultType, graphDefaultPeriod, analysisType, analysisPeriod, exListDetail int
	var weightIncr, bodyWeightIncr, bodyWeightGoalWeight float64
	var bodyWeightGoal int

	err = pgPool.QueryRow(ctx, `
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
		FROM settings WHERE user_id = $1`, userID).Scan(
		&metric, &firstDay, &selectedNav, &weightIncr, &bodyWeightIncr,
		&bodyWeightGoal, &bodyWeightGoalWeight, &bodyWeightShowLog, &est1RMMaxReps,
		&est1RMGraph, &trackPRs, &markComplete, &autoSelect, &keepScreenOn,
		&graphShowPoints, &graphShowTrend, &graphStartZero, &restTimerSecs, &restVibrate,
		&restSound, &restVol, &restAuto, &calDetail, &calDots, &calNav, &calHistoryDots,
		&calHistoryNames, &calHistorySets, &catSort, &catColours, &measTrackerLoad,
		&measShowLog, &graphDefaultType, &graphDefaultPeriod, &analysisType, &analysisPeriod, &exListDetail,
	)

	if err == nil {
		metricVal := 0
		if metric {
			metricVal = 1
		}
		bwLogVal := 0
		if bodyWeightShowLog {
			bwLogVal = 1
		}
		est1RMGraphVal := 0
		if est1RMGraph {
			est1RMGraphVal = 1
		}
		trackPRsVal := 0
		if trackPRs {
			trackPRsVal = 1
		}
		markCompleteVal := 0
		if markComplete {
			markCompleteVal = 1
		}
		autoSelectVal := 0
		if autoSelect {
			autoSelectVal = 1
		}
		keepScreenOnVal := 0
		if keepScreenOn {
			keepScreenOnVal = 1
		}
		graphPointsVal := 0
		if graphShowPoints {
			graphPointsVal = 1
		}
		graphTrendVal := 0
		if graphShowTrend {
			graphTrendVal = 1
		}
		graphZeroVal := 0
		if graphStartZero {
			graphZeroVal = 1
		}
		restVibVal := 0
		if restVibrate {
			restVibVal = 1
		}
		restSoundVal := 0
		if restSound {
			restSoundVal = 1
		}
		restAutoVal := 0
		if restAuto {
			restAutoVal = 1
		}
		calDetailVal := 0
		if calDetail {
			calDetailVal = 1
		}
		calDotsVal := 0
		if calDots {
			calDotsVal = 1
		}
		calNavVal := 0
		if calNav {
			calNavVal = 1
		}
		calHistDotsVal := 0
		if calHistoryDots {
			calHistDotsVal = 1
		}
		calHistNamesVal := 0
		if calHistoryNames {
			calHistNamesVal = 1
		}
		calHistSetsVal := 0
		if calHistorySets {
			calHistSetsVal = 1
		}
		catColorsVal := 0
		if catColours {
			catColorsVal = 1
		}
		measTrackerLoadVal := 0
		if measTrackerLoad {
			measTrackerLoadVal = 1
		}
		measShowLogVal := 0
		if measShowLog {
			measShowLogVal = 1
		}

		_, _ = sqliteDB.Exec(`
			INSERT INTO settings (
				metric, first_day_of_week, selected_navigation_item_id, weight_increment, body_weight_increment,
				body_weight_goal, body_weight_goal_weight, body_weight_show_in_workout_log, estimated_1rm_max_reps_to_include,
				estimated_1rm_max_apply_to_graph, track_personal_records, mark_sets_complete, auto_select_next_set, keep_screen_on,
				graph_show_points, graph_show_trend_line, graph_start_at_zero, rest_timer_seconds, rest_timer_vibrate,
				rest_timer_sound, rest_timer_volume, rest_timer_auto_start, calendar_detail_visible, calendar_category_dots_visible,
				calendar_navigation_bar_visible, calendar_history_category_dots_visible, calendar_history_category_names_visible,
				calendar_history_sets_visible, category_sort_order, category_show_colours, measurement_tracker_initial_load,
				measurement_show_in_workout_log, workout_graph_default_graph_type, workout_graph_default_time_period,
				analysis_breakdown_breakdown_type, analysis_breakdown_time_period, exercise_list_detail_type_id,
				workout_timer_auto_start_enabled, workout_timer_auto_stop_enabled, home_screen_limit_type_id,
				home_screen_limit_value, home_screen_category_visibility_id, home_screen_skip_empty_dates, app_theme_id
			) VALUES (
				?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
				?, ?, ?, ?, ?, ?, ?, 0, 0, 1,
				0, 1, 0, 1
			)`,
			metricVal, firstDay, selectedNav, int(weightIncr), int(bodyWeightIncr), bodyWeightGoal, int(bodyWeightGoalWeight), bwLogVal, est1RMMaxReps,
			est1RMGraphVal, trackPRsVal, markCompleteVal, autoSelectVal, keepScreenOnVal, graphPointsVal, graphTrendVal, graphZeroVal, restTimerSecs, restVibVal,
			restSoundVal, restVol, restAutoVal, calDetailVal, calDotsVal, calNavVal, calHistDotsVal, calHistNamesVal, calHistSetsVal, catSort, catColorsVal,
			measTrackerLoadVal, measShowLogVal, graphDefaultType, graphDefaultPeriod, analysisType, analysisPeriod, exListDetail,
		)
	}

	// 5. Read the final SQLite bytes from the closed DB file and stream it
	sqliteDB.Close()

	fileBytes, err := os.ReadFile(tempFileName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"failed to read compiled backup: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	timestamp := time.Now().Format("2006_01_02_15_04_05")
	filename := fmt.Sprintf("FitNotes_Backup_%s.fitnotes", timestamp)

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(fileBytes)))

	_, _ = w.Write(fileBytes)
}
