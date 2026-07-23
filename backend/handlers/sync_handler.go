package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"backend/db"
	"backend/middleware"
	"backend/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SyncRequest struct {
	LastSyncTimestamp          time.Time                          `json:"last_sync_timestamp"`
	Categories                 []models.Category                  `json:"categories"`
	Exercises                  []models.Exercise                  `json:"exercises"`
	Routines                   []models.Routine                   `json:"routines"`
	RoutineSections            []models.RoutineSection            `json:"routine_sections"`
	RoutineSectionExercises    []models.RoutineSectionExercise    `json:"routine_section_exercises"`
	RoutineSectionExerciseSets []models.RoutineSectionExerciseSet `json:"routine_section_exercise_sets"`
	TrainingLogs               []models.TrainingLog               `json:"training_logs"`
	BodyWeights                []models.BodyWeight                `json:"body_weights"`
	Plates                     []models.Plate                     `json:"plates"`
	Barbells                   []models.Barbell                   `json:"barbells"`
	WorkoutComments            []models.WorkoutComment            `json:"workout_comments"`
	WorkoutGroups              []models.WorkoutGroup              `json:"workout_groups"`
	WorkoutGroupExercises      []models.WorkoutGroupExercise      `json:"workout_group_exercises"`
	WorkoutRoutines            []models.WorkoutRoutine            `json:"workout_routines"`
	Goals                      []models.Goal                      `json:"goals"`
	Measurements               []models.Measurement               `json:"measurements"`
	MeasurementRecords         []models.MeasurementRecord         `json:"measurement_records"`
	ExerciseComments           []models.ExerciseComment           `json:"exercise_comments"`
	WorkoutTimes               []models.WorkoutTime               `json:"workout_times"`
	CustomUnits                []models.CustomUnit                `json:"custom_units"`
	GraphFavourites            []models.GraphFavourite            `json:"graph_favourites"`
	Settings                   *models.Settings                   `json:"settings"`
}

func syncHTTPError(w http.ResponseWriter, label string, err error) {
	log.Printf("sync error: %s: %v", label, err)
	http.Error(w, `{"error":"`+label+`: `+err.Error()+`"}`, http.StatusInternalServerError)
}

type SyncResponse struct {
	ServerTime                 time.Time                          `json:"server_time"`
	Categories                 []models.Category                  `json:"categories"`
	Exercises                  []models.Exercise                  `json:"exercises"`
	Routines                   []models.Routine                   `json:"routines"`
	RoutineSections            []models.RoutineSection            `json:"routine_sections"`
	RoutineSectionExercises    []models.RoutineSectionExercise    `json:"routine_section_exercises"`
	RoutineSectionExerciseSets []models.RoutineSectionExerciseSet `json:"routine_section_exercise_sets"`
	TrainingLogs               []models.TrainingLog               `json:"training_logs"`
	BodyWeights                []models.BodyWeight                `json:"body_weights"`
	Plates                     []models.Plate                     `json:"plates"`
	Barbells                   []models.Barbell                   `json:"barbells"`
	WorkoutComments            []models.WorkoutComment            `json:"workout_comments"`
	WorkoutGroups              []models.WorkoutGroup              `json:"workout_groups"`
	WorkoutGroupExercises      []models.WorkoutGroupExercise      `json:"workout_group_exercises"`
	WorkoutRoutines            []models.WorkoutRoutine            `json:"workout_routines"`
	Goals                      []models.Goal                      `json:"goals"`
	Measurements               []models.Measurement               `json:"measurements"`
	MeasurementRecords         []models.MeasurementRecord         `json:"measurement_records"`
	ExerciseComments           []models.ExerciseComment           `json:"exercise_comments"`
	WorkoutTimes               []models.WorkoutTime               `json:"workout_times"`
	CustomUnits                []models.CustomUnit                `json:"custom_units"`
	GraphFavourites            []models.GraphFavourite            `json:"graph_favourites"`
	Settings                   *models.Settings                   `json:"settings"`
}

func SyncHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// A type mismatch names the exact struct field (e.g. "cannot unmarshal
		// number into ... field TrainingLog.set_type of type string") - log it
		// so client payload bugs are diagnosable from the server side.
		log.Printf("sync: payload decode failed for user %s: %v", userID, err)
		http.Error(w, `{"error":"invalid sync payload: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()
	serverTime := time.Now().UTC()

	// Perform all sync processing inside a single transaction to ensure consistency
	tx, err := pool.Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"failed to begin transaction"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 1. Process Incoming Client Data (PUSH)
	if err := pushCategories(ctx, tx, userID, req.Categories); err != nil {
		syncHTTPError(w, "failed to sync categories", err)
		return
	}
	if err := pushExercises(ctx, tx, userID, req.Exercises); err != nil {
		syncHTTPError(w, "failed to sync exercises", err)
		return
	}
	// Routine templates - parents before children so FKs resolve, and before
	// workout_groups (whose routine_section_id references routine_sections).
	if err := pushRoutines(ctx, tx, userID, req.Routines); err != nil {
		syncHTTPError(w, "failed to sync routines", err)
		return
	}
	if err := pushRoutineSections(ctx, tx, req.RoutineSections); err != nil {
		syncHTTPError(w, "failed to sync routine sections", err)
		return
	}
	if err := pushRoutineSectionExercises(ctx, tx, req.RoutineSectionExercises); err != nil {
		syncHTTPError(w, "failed to sync routine section exercises", err)
		return
	}
	if err := pushRoutineSectionExerciseSets(ctx, tx, req.RoutineSectionExerciseSets); err != nil {
		syncHTTPError(w, "failed to sync routine section exercise sets", err)
		return
	}
	if err := pushTrainingLogs(ctx, tx, userID, req.TrainingLogs); err != nil {
		syncHTTPError(w, "failed to sync training logs", err)
		return
	}
	if err := pushBodyWeights(ctx, tx, userID, req.BodyWeights); err != nil {
		syncHTTPError(w, "failed to sync body weights", err)
		return
	}
	if err := pushPlates(ctx, tx, userID, req.Plates); err != nil {
		syncHTTPError(w, "failed to sync plates", err)
		return
	}
	if err := pushBarbells(ctx, tx, userID, req.Barbells); err != nil {
		syncHTTPError(w, "failed to sync barbells", err)
		return
	}
	if err := pushWorkoutComments(ctx, tx, userID, req.WorkoutComments); err != nil {
		syncHTTPError(w, "failed to sync workout comments", err)
		return
	}
	if err := pushWorkoutGroups(ctx, tx, userID, req.WorkoutGroups); err != nil {
		syncHTTPError(w, "failed to sync workout groups", err)
		return
	}
	if err := pushWorkoutGroupExercises(ctx, tx, userID, req.WorkoutGroupExercises); err != nil {
		syncHTTPError(w, "failed to sync workout group exercises", err)
		return
	}
	if err := pushWorkoutRoutines(ctx, tx, userID, req.WorkoutRoutines); err != nil {
		syncHTTPError(w, "failed to sync workout routines", err)
		return
	}
	if err := pushGoals(ctx, tx, userID, req.Goals); err != nil {
		syncHTTPError(w, "failed to sync goals", err)
		return
	}
	// Measurements before measurement_records (FK).
	if err := pushMeasurements(ctx, tx, userID, req.Measurements); err != nil {
		syncHTTPError(w, "failed to sync measurements", err)
		return
	}
	if err := pushMeasurementRecords(ctx, tx, userID, req.MeasurementRecords); err != nil {
		syncHTTPError(w, "failed to sync measurement records", err)
		return
	}
	if err := pushExerciseComments(ctx, tx, userID, req.ExerciseComments); err != nil {
		syncHTTPError(w, "failed to sync exercise comments", err)
		return
	}
	if err := pushWorkoutTimes(ctx, tx, userID, req.WorkoutTimes); err != nil {
		syncHTTPError(w, "failed to sync workout times", err)
		return
	}
	if err := pushCustomUnits(ctx, tx, userID, req.CustomUnits); err != nil {
		syncHTTPError(w, "failed to sync custom units", err)
		return
	}
	if err := pushGraphFavourites(ctx, tx, userID, req.GraphFavourites); err != nil {
		syncHTTPError(w, "failed to sync graph favourites", err)
		return
	}
	if req.Settings != nil {
		if err := pushSettings(ctx, tx, userID, req.Settings); err != nil {
			syncHTTPError(w, "failed to sync settings", err)
			return
		}
	}

	// 2. Fetch Server Updates (PULL)
	resp := SyncResponse{
		ServerTime: serverTime,
	}

	if resp.Categories, err = pullCategories(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch category updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Exercises, err = pullExercises(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch exercise updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Routines, err = pullRoutines(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch routine updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.RoutineSections, err = pullRoutineSections(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch routine section updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.RoutineSectionExercises, err = pullRoutineSectionExercises(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch routine section exercise updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.RoutineSectionExerciseSets, err = pullRoutineSectionExerciseSets(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch routine section exercise set updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.TrainingLogs, err = pullTrainingLogs(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch training log updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.BodyWeights, err = pullBodyWeights(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch body weight updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Plates, err = pullPlates(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch plate updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Barbells, err = pullBarbells(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch barbell updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.WorkoutComments, err = pullWorkoutComments(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch workout comment updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.WorkoutGroups, err = pullWorkoutGroups(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch workout group updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.WorkoutGroupExercises, err = pullWorkoutGroupExercises(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch workout group exercise updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.WorkoutRoutines, err = pullWorkoutRoutines(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch workout routine updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Goals, err = pullGoals(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch goal updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Measurements, err = pullMeasurements(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch measurement updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.MeasurementRecords, err = pullMeasurementRecords(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch measurement record updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.ExerciseComments, err = pullExerciseComments(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch exercise comment updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.WorkoutTimes, err = pullWorkoutTimes(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch workout time updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.CustomUnits, err = pullCustomUnits(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch custom unit updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.GraphFavourites, err = pullGraphFavourites(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch graph favourite updates"}`, http.StatusInternalServerError)
		return
	}
	if resp.Settings, err = pullSettings(ctx, tx, userID, req.LastSyncTimestamp); err != nil {
		http.Error(w, `{"error":"failed to fetch settings updates"}`, http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"failed to commit transaction"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(resp)
}

// --- CATEGORIES SYNC ---

func pushCategories(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Category) error {
	query := `
		INSERT INTO categories (id, user_id, name, colour, sort_order, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			colour = EXCLUDED.colour,
			sort_order = EXCLUDED.sort_order,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE categories.user_id = EXCLUDED.user_id 
		  AND categories.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		_, err := tx.Exec(ctx, query, item.ID, userID, item.Name, item.Colour, item.SortOrder, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullCategories(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Category, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, name, colour, sort_order, last_modified, is_deleted FROM categories WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Category
	for rows.Next() {
		var item models.Category
		err := rows.Scan(&item.ID, &item.UserID, &item.Name, &item.Colour, &item.SortOrder, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- EXERCISES SYNC ---

func pushExercises(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Exercise) error {
	query := `
		INSERT INTO exercises (id, user_id, name, category_id, exercise_type_id, notes, weight_increment, default_rest_time, weight_unit_id, is_favourite, aliases, instructions, video_url, equipment, primary_muscles, secondary_muscles, regressions, progressions, substitutions, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			category_id = EXCLUDED.category_id,
			exercise_type_id = EXCLUDED.exercise_type_id,
			notes = EXCLUDED.notes,
			weight_increment = EXCLUDED.weight_increment,
			default_rest_time = EXCLUDED.default_rest_time,
			weight_unit_id = EXCLUDED.weight_unit_id,
			is_favourite = EXCLUDED.is_favourite,
			aliases = EXCLUDED.aliases,
			instructions = EXCLUDED.instructions,
			video_url = EXCLUDED.video_url,
			equipment = EXCLUDED.equipment,
			primary_muscles = EXCLUDED.primary_muscles,
			secondary_muscles = EXCLUDED.secondary_muscles,
			regressions = EXCLUDED.regressions,
			progressions = EXCLUDED.progressions,
			substitutions = EXCLUDED.substitutions,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE exercises.user_id = EXCLUDED.user_id
		  AND exercises.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		_, err := tx.Exec(ctx, query, item.ID, userID, item.Name, item.CategoryID, item.ExerciseTypeID, item.Notes, item.WeightIncrement, item.DefaultRestTime, item.WeightUnitID, item.IsFavourite, item.Aliases, item.Instructions, item.VideoURL, item.Equipment, item.PrimaryMuscles, item.SecondaryMuscles, item.Regressions, item.Progressions, item.Substitutions, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullExercises(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Exercise, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, name, category_id, exercise_type_id, notes, weight_increment, default_rest_time, weight_unit_id, is_favourite, aliases, instructions, video_url, equipment, primary_muscles, secondary_muscles, regressions, progressions, substitutions, last_modified, is_deleted FROM exercises WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Exercise
	for rows.Next() {
		var item models.Exercise
		err := rows.Scan(&item.ID, &item.UserID, &item.Name, &item.CategoryID, &item.ExerciseTypeID, &item.Notes, &item.WeightIncrement, &item.DefaultRestTime, &item.WeightUnitID, &item.IsFavourite, &item.Aliases, &item.Instructions, &item.VideoURL, &item.Equipment, &item.PrimaryMuscles, &item.SecondaryMuscles, &item.Regressions, &item.Progressions, &item.Substitutions, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- TRAINING LOGS SYNC ---

func pushTrainingLogs(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.TrainingLog) error {
	query := `
		INSERT INTO training_logs (id, user_id, exercise_id, date, metric_weight, reps, unit, routine_section_exercise_set_id, is_personal_record, is_complete, distance, duration_seconds, comment, rpe, rir, set_type, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE(NULLIF($16, ''), 'working'), $17, $18)
		ON CONFLICT (id) DO UPDATE SET
			exercise_id = EXCLUDED.exercise_id,
			date = EXCLUDED.date,
			metric_weight = EXCLUDED.metric_weight,
			reps = EXCLUDED.reps,
			unit = EXCLUDED.unit,
			routine_section_exercise_set_id = EXCLUDED.routine_section_exercise_set_id,
			is_personal_record = EXCLUDED.is_personal_record,
			is_complete = EXCLUDED.is_complete,
			distance = EXCLUDED.distance,
			duration_seconds = EXCLUDED.duration_seconds,
			comment = EXCLUDED.comment,
			rpe = EXCLUDED.rpe,
			rir = EXCLUDED.rir,
			set_type = EXCLUDED.set_type,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE training_logs.user_id = EXCLUDED.user_id
		  AND training_logs.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		// Parse standard date string YYYY-MM-DD
		parsedDate, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, query, item.ID, userID, item.ExerciseID, parsedDate, item.MetricWeight, item.Reps, item.Unit, item.RoutineSectionExerciseSetID, item.IsPersonalRecord, item.IsComplete, item.Distance, item.DurationSeconds, item.Comment, item.RPE, item.RIR, item.SetType, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullTrainingLogs(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.TrainingLog, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, exercise_id, date, metric_weight, reps, unit, routine_section_exercise_set_id, is_personal_record, is_complete, distance, duration_seconds, comment, rpe, rir, set_type, last_modified, is_deleted FROM training_logs WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.TrainingLog
	for rows.Next() {
		var item models.TrainingLog
		var dateVal time.Time
		err := rows.Scan(&item.ID, &item.UserID, &item.ExerciseID, &dateVal, &item.MetricWeight, &item.Reps, &item.Unit, &item.RoutineSectionExerciseSetID, &item.IsPersonalRecord, &item.IsComplete, &item.Distance, &item.DurationSeconds, &item.Comment, &item.RPE, &item.RIR, &item.SetType, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		item.Date = dateVal.Format("2006-01-02")
		list = append(list, item)
	}
	return list, nil
}

// --- BODY WEIGHTS SYNC ---

func pushBodyWeights(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.BodyWeight) error {
	query := `
		INSERT INTO body_weights (id, user_id, date, measured_at, body_weight_metric, body_fat, comments, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			date = EXCLUDED.date,
			measured_at = EXCLUDED.measured_at,
			body_weight_metric = EXCLUDED.body_weight_metric,
			body_fat = EXCLUDED.body_fat,
			comments = EXCLUDED.comments,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE body_weights.user_id = EXCLUDED.user_id
		  AND body_weights.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		parsedDate, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			return err
		}
		measuredAt := item.MeasuredAt
		if measuredAt == nil {
			measuredAt = &parsedDate
		}
		_, err = tx.Exec(ctx, query, item.ID, userID, parsedDate, measuredAt, item.BodyWeightMetric, item.BodyFat, item.Comments, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullBodyWeights(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.BodyWeight, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, date, COALESCE(measured_at, date::timestamp AT TIME ZONE 'UTC'), body_weight_metric, body_fat, comments, last_modified, is_deleted FROM body_weights WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.BodyWeight
	for rows.Next() {
		var item models.BodyWeight
		var dateVal time.Time
		var measuredAt time.Time
		err := rows.Scan(&item.ID, &item.UserID, &dateVal, &measuredAt, &item.BodyWeightMetric, &item.BodyFat, &item.Comments, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		item.Date = dateVal.Format("2006-01-02")
		item.MeasuredAt = &measuredAt
		list = append(list, item)
	}
	return list, nil
}

// --- PLATES SYNC ---

func pushPlates(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Plate) error {
	query := `
		INSERT INTO plates (id, user_id, weight, unit, count, enabled, colour, width_ratio, height_ratio, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			weight = EXCLUDED.weight,
			unit = EXCLUDED.unit,
			count = EXCLUDED.count,
			enabled = EXCLUDED.enabled,
			colour = EXCLUDED.colour,
			width_ratio = EXCLUDED.width_ratio,
			height_ratio = EXCLUDED.height_ratio,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE plates.user_id = EXCLUDED.user_id
		  AND plates.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		_, err := tx.Exec(ctx, query, item.ID, userID, item.Weight, item.Unit, item.Count, item.Enabled, item.Colour, item.WidthRatio, item.HeightRatio, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullPlates(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Plate, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, weight, unit, count, enabled, colour, width_ratio, height_ratio, last_modified, is_deleted FROM plates WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Plate
	for rows.Next() {
		var item models.Plate
		err := rows.Scan(&item.ID, &item.UserID, &item.Weight, &item.Unit, &item.Count, &item.Enabled, &item.Colour, &item.WidthRatio, &item.HeightRatio, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- BARBELLS SYNC ---

func pushBarbells(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Barbell) error {
	query := `
		INSERT INTO barbells (id, user_id, weight, unit, exercise_id, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			weight = EXCLUDED.weight,
			unit = EXCLUDED.unit,
			exercise_id = EXCLUDED.exercise_id,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE barbells.user_id = EXCLUDED.user_id
		  AND barbells.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		_, err := tx.Exec(ctx, query, item.ID, userID, item.Weight, item.Unit, item.ExerciseID, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullBarbells(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Barbell, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, weight, unit, exercise_id, last_modified, is_deleted FROM barbells WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Barbell
	for rows.Next() {
		var item models.Barbell
		err := rows.Scan(&item.ID, &item.UserID, &item.Weight, &item.Unit, &item.ExerciseID, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- WORKOUT COMMENTS SYNC ---

func pushWorkoutComments(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.WorkoutComment) error {
	query := `
		INSERT INTO workout_comments (id, user_id, date, comment, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, date) DO UPDATE SET
			comment = EXCLUDED.comment,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE workout_comments.user_id = EXCLUDED.user_id
		  AND workout_comments.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		parsedDate, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, query, item.ID, userID, parsedDate, item.Comment, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullWorkoutComments(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.WorkoutComment, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, date, comment, last_modified, is_deleted FROM workout_comments WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.WorkoutComment
	for rows.Next() {
		var item models.WorkoutComment
		var dateVal time.Time
		err := rows.Scan(&item.ID, &item.UserID, &dateVal, &item.Comment, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		item.Date = dateVal.Format("2006-01-02")
		list = append(list, item)
	}
	return list, nil
}

// --- SETTINGS SYNC ---

func pushSettings(ctx context.Context, tx pgx.Tx, userID uuid.UUID, s *models.Settings) error {
	query := `
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
			home_screen_limit_value, home_screen_category_visibility_id, home_screen_skip_empty_dates, app_theme_id, distance_unit, last_modified
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
			$26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47
		) ON CONFLICT (user_id) DO UPDATE SET
			metric = EXCLUDED.metric,
			first_day_of_week = EXCLUDED.first_day_of_week,
			selected_navigation_item_id = EXCLUDED.selected_navigation_item_id,
			weight_increment = EXCLUDED.weight_increment,
			body_weight_increment = EXCLUDED.body_weight_increment,
			body_weight_goal = EXCLUDED.body_weight_goal,
			body_weight_goal_weight = EXCLUDED.body_weight_goal_weight,
			body_weight_show_in_workout_log = EXCLUDED.body_weight_show_in_workout_log,
			estimated_1rm_max_reps_to_include = EXCLUDED.estimated_1rm_max_reps_to_include,
			estimated_1rm_max_apply_to_graph = EXCLUDED.estimated_1rm_max_apply_to_graph,
			track_personal_records = EXCLUDED.track_personal_records,
			mark_sets_complete = EXCLUDED.mark_sets_complete,
			auto_select_next_set = EXCLUDED.auto_select_next_set,
			keep_screen_on = EXCLUDED.keep_screen_on,
			graph_show_points = EXCLUDED.graph_show_points,
			graph_show_trend_line = EXCLUDED.graph_show_trend_line,
			graph_start_at_zero = EXCLUDED.graph_start_at_zero,
			rest_timer_seconds = EXCLUDED.rest_timer_seconds,
			rest_timer_vibrate = EXCLUDED.rest_timer_vibrate,
			rest_timer_sound = EXCLUDED.rest_timer_sound,
			rest_timer_volume = EXCLUDED.rest_timer_volume,
			rest_timer_auto_start = EXCLUDED.rest_timer_auto_start,
			calendar_detail_visible = EXCLUDED.calendar_detail_visible,
			calendar_category_dots_visible = EXCLUDED.calendar_category_dots_visible,
			calendar_navigation_bar_visible = EXCLUDED.calendar_navigation_bar_visible,
			calendar_history_category_dots_visible = EXCLUDED.calendar_history_category_dots_visible,
			calendar_history_category_names_visible = EXCLUDED.calendar_history_category_names_visible,
			calendar_history_sets_visible = EXCLUDED.calendar_history_sets_visible,
			category_sort_order = EXCLUDED.category_sort_order,
			category_show_colours = EXCLUDED.category_show_colours,
			measurement_tracker_initial_load = EXCLUDED.measurement_tracker_initial_load,
			measurement_show_in_workout_log = EXCLUDED.measurement_show_in_workout_log,
			workout_graph_default_graph_type = EXCLUDED.workout_graph_default_graph_type,
			workout_graph_default_time_period = EXCLUDED.workout_graph_default_time_period,
			analysis_breakdown_breakdown_type = EXCLUDED.analysis_breakdown_breakdown_type,
			analysis_breakdown_time_period = EXCLUDED.analysis_breakdown_time_period,
			exercise_list_detail_type_id = EXCLUDED.exercise_list_detail_type_id,
			workout_timer_auto_start_enabled = EXCLUDED.workout_timer_auto_start_enabled,
			workout_timer_auto_stop_enabled = EXCLUDED.workout_timer_auto_stop_enabled,
			home_screen_limit_type_id = EXCLUDED.home_screen_limit_type_id,
			home_screen_limit_value = EXCLUDED.home_screen_limit_value,
			home_screen_category_visibility_id = EXCLUDED.home_screen_category_visibility_id,
			home_screen_skip_empty_dates = EXCLUDED.home_screen_skip_empty_dates,
			app_theme_id = EXCLUDED.app_theme_id,
			distance_unit = EXCLUDED.distance_unit,
			last_modified = EXCLUDED.last_modified
		WHERE settings.user_id = EXCLUDED.user_id
		  AND settings.last_modified < EXCLUDED.last_modified
	`
	_, err := tx.Exec(ctx, query, userID, s.Metric, s.FirstDayOfWeek, s.SelectedNavigationItemID, s.WeightIncrement, s.BodyWeightIncrement,
		s.BodyWeightGoal, s.BodyWeightGoalWeight, s.BodyWeightShowInWorkoutLog, s.Estimated1RMMaxRepsToInclude,
		s.Estimated1RMMaxApplyToGraph, s.TrackPersonalRecords, s.MarkSetsComplete, s.AutoSelectNextSet, s.KeepScreenOn,
		s.GraphShowPoints, s.GraphShowTrendLine, s.GraphStartAtZero, s.RestTimerSeconds, s.RestTimerVibrate,
		s.RestTimerSound, s.RestTimerVolume, s.RestTimerAutoStart, s.CalendarDetailVisible, s.CalendarCategoryDotsVisible,
		s.CalendarNavigationBarVisible, s.CalendarHistoryCategoryDotsVisible, s.CalendarHistoryCategoryNamesVisible,
		s.CalendarHistorySetsVisible, s.CategorySortOrder, s.CategoryShowColours, s.MeasurementTrackerInitialLoad,
		s.MeasurementShowInWorkoutLog, s.WorkoutGraphDefaultGraphType, s.WorkoutGraphDefaultTimePeriod,
		s.AnalysisBreakdownBreakdownType, s.AnalysisBreakdownTimePeriod, s.ExerciseListDetailTypeID,
		s.WorkoutTimerAutoStartEnabled, s.WorkoutTimerAutoStopEnabled, s.HomeScreenLimitTypeID,
		s.HomeScreenLimitValue, s.HomeScreenCategoryVisibilityID, s.HomeScreenSkipEmptyDates, s.AppThemeID, s.DistanceUnit, s.LastModified,
	)
	return err
}

func pullSettings(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) (*models.Settings, error) {
	var s models.Settings
	err := tx.QueryRow(ctx, `
		SELECT 
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
			home_screen_limit_value, home_screen_category_visibility_id, home_screen_skip_empty_dates, app_theme_id, distance_unit, last_modified
		FROM settings WHERE user_id = $1 AND last_modified > $2`,
		userID, since,
	).Scan(
		&s.UserID, &s.Metric, &s.FirstDayOfWeek, &s.SelectedNavigationItemID, &s.WeightIncrement, &s.BodyWeightIncrement,
		&s.BodyWeightGoal, &s.BodyWeightGoalWeight, &s.BodyWeightShowInWorkoutLog, &s.Estimated1RMMaxRepsToInclude,
		&s.Estimated1RMMaxApplyToGraph, &s.TrackPersonalRecords, &s.MarkSetsComplete, &s.AutoSelectNextSet, &s.KeepScreenOn,
		&s.GraphShowPoints, &s.GraphShowTrendLine, &s.GraphStartAtZero, &s.RestTimerSeconds, &s.RestTimerVibrate,
		&s.RestTimerSound, &s.RestTimerVolume, &s.RestTimerAutoStart, &s.CalendarDetailVisible, &s.CalendarCategoryDotsVisible,
		&s.CalendarNavigationBarVisible, &s.CalendarHistoryCategoryDotsVisible, &s.CalendarHistoryCategoryNamesVisible,
		&s.CalendarHistorySetsVisible, &s.CategorySortOrder, &s.CategoryShowColours, &s.MeasurementTrackerInitialLoad,
		&s.MeasurementShowInWorkoutLog, &s.WorkoutGraphDefaultGraphType, &s.WorkoutGraphDefaultTimePeriod,
		&s.AnalysisBreakdownBreakdownType, &s.AnalysisBreakdownTimePeriod, &s.ExerciseListDetailTypeID,
		&s.WorkoutTimerAutoStartEnabled, &s.WorkoutTimerAutoStopEnabled, &s.HomeScreenLimitTypeID,
		&s.HomeScreenLimitValue, &s.HomeScreenCategoryVisibilityID, &s.HomeScreenSkipEmptyDates, &s.AppThemeID, &s.DistanceUnit, &s.LastModified,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No settings changes
		}
		return nil, err
	}
	return &s, nil
}

// --- WORKOUT GROUPS SYNC ---

func pushWorkoutGroups(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.WorkoutGroup) error {
	query := `
		INSERT INTO workout_groups (id, user_id, name, date, colour, routine_section_id, auto_jump_enabled, rest_timer_auto_start_enabled, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			date = EXCLUDED.date,
			colour = EXCLUDED.colour,
			routine_section_id = EXCLUDED.routine_section_id,
			auto_jump_enabled = EXCLUDED.auto_jump_enabled,
			rest_timer_auto_start_enabled = EXCLUDED.rest_timer_auto_start_enabled,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE workout_groups.user_id = EXCLUDED.user_id
		  AND workout_groups.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		var parsedDate time.Time
		var err error
		if item.Date == "" {
			parsedDate = time.Time{} // zero time
		} else {
			parsedDate, err = time.Parse("2006-01-02", item.Date)
			if err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, query, item.ID, userID, item.Name, parsedDate, item.Colour, item.RoutineSectionID, item.AutoJumpEnabled, item.RestTimerAutoStartEnabled, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullWorkoutGroups(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.WorkoutGroup, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, name, date, colour, routine_section_id, auto_jump_enabled, rest_timer_auto_start_enabled, last_modified, is_deleted FROM workout_groups WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.WorkoutGroup
	for rows.Next() {
		var item models.WorkoutGroup
		var dateVal time.Time
		err := rows.Scan(&item.ID, &item.UserID, &item.Name, &dateVal, &item.Colour, &item.RoutineSectionID, &item.AutoJumpEnabled, &item.RestTimerAutoStartEnabled, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		if dateVal.IsZero() {
			item.Date = ""
		} else {
			item.Date = dateVal.Format("2006-01-02")
		}
		list = append(list, item)
	}
	return list, nil
}

// --- WORKOUT ROUTINES SYNC ---

func pushWorkoutRoutines(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.WorkoutRoutine) error {
	query := `
		INSERT INTO workout_routines (id, user_id, date, routine_id, routine_section_id, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			date = EXCLUDED.date,
			routine_id = EXCLUDED.routine_id,
			routine_section_id = EXCLUDED.routine_section_id,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE workout_routines.user_id = EXCLUDED.user_id
		  AND workout_routines.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		parsedDate, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, query, item.ID, userID, parsedDate, item.RoutineID, item.RoutineSectionID, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullWorkoutRoutines(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.WorkoutRoutine, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, date, routine_id, routine_section_id, last_modified, is_deleted FROM workout_routines WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.WorkoutRoutine
	for rows.Next() {
		var item models.WorkoutRoutine
		var dateVal time.Time
		err := rows.Scan(&item.ID, &item.UserID, &dateVal, &item.RoutineID, &item.RoutineSectionID, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		item.Date = dateVal.Format("2006-01-02")
		list = append(list, item)
	}
	return list, nil
}

// --- WORKOUT GROUP EXERCISES SYNC ---

func pushWorkoutGroupExercises(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.WorkoutGroupExercise) error {
	query := `
		INSERT INTO workout_group_exercises (id, user_id, exercise_id, date, routine_section_id, workout_group_id, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			exercise_id = EXCLUDED.exercise_id,
			date = EXCLUDED.date,
			routine_section_id = EXCLUDED.routine_section_id,
			workout_group_id = EXCLUDED.workout_group_id,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE workout_group_exercises.user_id = EXCLUDED.user_id
		  AND workout_group_exercises.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		var parsedDate time.Time
		var err error
		if item.Date == "" {
			parsedDate = time.Time{} // zero time
		} else {
			parsedDate, err = time.Parse("2006-01-02", item.Date)
			if err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, query, item.ID, userID, item.ExerciseID, parsedDate, item.RoutineSectionID, item.WorkoutGroupID, item.LastModified, item.IsDeleted)
		if err != nil {
			return err
		}
	}
	return nil
}

func pullWorkoutGroupExercises(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.WorkoutGroupExercise, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, exercise_id, date, routine_section_id, workout_group_id, last_modified, is_deleted FROM workout_group_exercises WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.WorkoutGroupExercise
	for rows.Next() {
		var item models.WorkoutGroupExercise
		var dateVal time.Time
		err := rows.Scan(&item.ID, &item.UserID, &item.ExerciseID, &dateVal, &item.RoutineSectionID, &item.WorkoutGroupID, &item.LastModified, &item.IsDeleted)
		if err != nil {
			return nil, err
		}
		if dateVal.IsZero() {
			item.Date = ""
		} else {
			item.Date = dateVal.Format("2006-01-02")
		}
		list = append(list, item)
	}
	return list, nil
}
