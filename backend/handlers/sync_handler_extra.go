package handlers

import (
	"context"
	"time"

	"backend/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Additional sync push/pull functions for routine templates, goals, and
// measurements. These mirror the last-write-wins pattern in sync_handler.go.
//
// Ownership note: routine_sections / routine_section_exercises /
// routine_section_exercise_sets have no user_id column, so PULL queries join up
// to the owning routine to scope by user. PUSH relies on the LWW timestamp guard
// plus the FK-safe ordering enforced by the caller (routines before sections
// before exercises before sets, and all of them before workout_groups, whose
// routine_section_id references routine_sections).

// --- ROUTINES SYNC ---

func pushRoutines(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Routine) error {
	query := `
		INSERT INTO routines (id, user_id, name, notes, category, version, program_weeks, current_week, start_date, is_archived, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, GREATEST($6, 1), GREATEST($7, 1), GREATEST($8, 1), $9::date, $10, $11, $12)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			notes = EXCLUDED.notes,
			category = EXCLUDED.category,
			version = EXCLUDED.version,
			program_weeks = EXCLUDED.program_weeks,
			current_week = EXCLUDED.current_week,
			start_date = EXCLUDED.start_date,
			is_archived = EXCLUDED.is_archived,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE routines.user_id = EXCLUDED.user_id
		  AND routines.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.Name, item.Notes, item.Category, item.Version, item.ProgramWeeks, item.CurrentWeek, item.StartDate, item.IsArchived, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullRoutines(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Routine, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, name, notes, category, version, program_weeks, current_week, start_date::text, is_archived, last_modified, is_deleted FROM routines WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Routine
	for rows.Next() {
		var item models.Routine
		if err := rows.Scan(&item.ID, &item.UserID, &item.Name, &item.Notes, &item.Category, &item.Version, &item.ProgramWeeks, &item.CurrentWeek, &item.StartDate, &item.IsArchived, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- ROUTINE SECTIONS SYNC ---

func pushRoutineSections(ctx context.Context, tx pgx.Tx, items []models.RoutineSection) error {
	query := `
		INSERT INTO routine_sections (id, routine_id, name, sort_order, week_number, day_of_week, phase, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, GREATEST($5, 1), $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			routine_id = EXCLUDED.routine_id,
			name = EXCLUDED.name,
			sort_order = EXCLUDED.sort_order,
			week_number = EXCLUDED.week_number,
			day_of_week = EXCLUDED.day_of_week,
			phase = EXCLUDED.phase,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE routine_sections.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, item.RoutineID, item.Name, item.SortOrder, item.WeekNumber, item.DayOfWeek, item.Phase, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullRoutineSections(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.RoutineSection, error) {
	rows, err := tx.Query(ctx, `
		SELECT rs.id, rs.routine_id, rs.name, rs.sort_order, rs.week_number, rs.day_of_week, rs.phase, rs.last_modified, rs.is_deleted
		FROM routine_sections rs
		JOIN routines r ON rs.routine_id = r.id
		WHERE r.user_id = $1 AND rs.last_modified > $2`,
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.RoutineSection
	for rows.Next() {
		var item models.RoutineSection
		if err := rows.Scan(&item.ID, &item.RoutineID, &item.Name, &item.SortOrder, &item.WeekNumber, &item.DayOfWeek, &item.Phase, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- ROUTINE SECTION EXERCISES SYNC ---

func pushRoutineSectionExercises(ctx context.Context, tx pgx.Tx, items []models.RoutineSectionExercise) error {
	query := `
		INSERT INTO routine_section_exercises (id, routine_section_id, exercise_id, sort_order, populate_sets_type, progression_enabled, progression_increment, progression_reps_step, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, GREATEST($8, 1), $9, $10)
		ON CONFLICT (id) DO UPDATE SET
			routine_section_id = EXCLUDED.routine_section_id,
			exercise_id = EXCLUDED.exercise_id,
			sort_order = EXCLUDED.sort_order,
			populate_sets_type = EXCLUDED.populate_sets_type,
			progression_enabled = EXCLUDED.progression_enabled,
			progression_increment = EXCLUDED.progression_increment,
			progression_reps_step = EXCLUDED.progression_reps_step,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE routine_section_exercises.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, item.RoutineSectionID, item.ExerciseID, item.SortOrder, item.PopulateSetsType, item.ProgressionEnabled, item.ProgressionIncrement, item.ProgressionRepsStep, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullRoutineSectionExercises(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.RoutineSectionExercise, error) {
	rows, err := tx.Query(ctx, `
		SELECT rse.id, rse.routine_section_id, rse.exercise_id, rse.sort_order, rse.populate_sets_type, rse.progression_enabled, rse.progression_increment, rse.progression_reps_step, rse.last_modified, rse.is_deleted
		FROM routine_section_exercises rse
		JOIN routine_sections rs ON rse.routine_section_id = rs.id
		JOIN routines r ON rs.routine_id = r.id
		WHERE r.user_id = $1 AND rse.last_modified > $2`,
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.RoutineSectionExercise
	for rows.Next() {
		var item models.RoutineSectionExercise
		if err := rows.Scan(&item.ID, &item.RoutineSectionID, &item.ExerciseID, &item.SortOrder, &item.PopulateSetsType, &item.ProgressionEnabled, &item.ProgressionIncrement, &item.ProgressionRepsStep, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- ROUTINE SECTION EXERCISE SETS SYNC ---

func pushRoutineSectionExerciseSets(ctx context.Context, tx pgx.Tx, items []models.RoutineSectionExerciseSet) error {
	query := `
		INSERT INTO routine_section_exercise_sets (id, routine_section_exercise_id, metric_weight, reps, sort_order, distance, duration_seconds, unit, min_reps, max_reps, set_type, target_rir, tempo, notes, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE(NULLIF($11, ''), 'working'), $12, $13, $14, $15, $16)
		ON CONFLICT (id) DO UPDATE SET
			routine_section_exercise_id = EXCLUDED.routine_section_exercise_id,
			metric_weight = EXCLUDED.metric_weight,
			reps = EXCLUDED.reps,
			sort_order = EXCLUDED.sort_order,
			distance = EXCLUDED.distance,
			duration_seconds = EXCLUDED.duration_seconds,
			unit = EXCLUDED.unit,
			min_reps = EXCLUDED.min_reps,
			max_reps = EXCLUDED.max_reps,
			set_type = EXCLUDED.set_type,
			target_rir = EXCLUDED.target_rir,
			tempo = EXCLUDED.tempo,
			notes = EXCLUDED.notes,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE routine_section_exercise_sets.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, item.RoutineSectionExerciseID, item.MetricWeight, item.Reps, item.SortOrder, item.Distance, item.DurationSeconds, item.Unit, item.MinReps, item.MaxReps, item.SetType, item.TargetRIR, item.Tempo, item.Notes, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullRoutineSectionExerciseSets(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.RoutineSectionExerciseSet, error) {
	rows, err := tx.Query(ctx, `
		SELECT s.id, s.routine_section_exercise_id, s.metric_weight, s.reps, s.sort_order, s.distance, s.duration_seconds, s.unit, s.min_reps, s.max_reps, s.set_type, s.target_rir, s.tempo, s.notes, s.last_modified, s.is_deleted
		FROM routine_section_exercise_sets s
		JOIN routine_section_exercises rse ON s.routine_section_exercise_id = rse.id
		JOIN routine_sections rs ON rse.routine_section_id = rs.id
		JOIN routines r ON rs.routine_id = r.id
		WHERE r.user_id = $1 AND s.last_modified > $2`,
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.RoutineSectionExerciseSet
	for rows.Next() {
		var item models.RoutineSectionExerciseSet
		if err := rows.Scan(&item.ID, &item.RoutineSectionExerciseID, &item.MetricWeight, &item.Reps, &item.SortOrder, &item.Distance, &item.DurationSeconds, &item.Unit, &item.MinReps, &item.MaxReps, &item.SetType, &item.TargetRIR, &item.Tempo, &item.Notes, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- GOALS SYNC ---

func pushGoals(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Goal) error {
	query := `
		INSERT INTO goals (id, user_id, type_id, exercise_id, metric_weight, reps, unit, title, target_date, sort_order, distance, duration_seconds, start_date, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13::date, $14, $15)
		ON CONFLICT (id) DO UPDATE SET
			type_id = EXCLUDED.type_id,
			exercise_id = EXCLUDED.exercise_id,
			metric_weight = EXCLUDED.metric_weight,
			reps = EXCLUDED.reps,
			unit = EXCLUDED.unit,
			title = EXCLUDED.title,
			target_date = EXCLUDED.target_date,
			sort_order = EXCLUDED.sort_order,
			distance = EXCLUDED.distance,
			duration_seconds = EXCLUDED.duration_seconds,
			start_date = EXCLUDED.start_date,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE goals.user_id = EXCLUDED.user_id
		  AND goals.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query,
			item.ID, userID, item.TypeID, item.ExerciseID, item.MetricWeight, item.Reps, item.Unit,
			item.Title, item.TargetDate, item.SortOrder, item.Distance, item.DurationSeconds, item.StartDate,
			item.LastModified, item.IsDeleted,
		); err != nil {
			return err
		}
	}
	return nil
}

func pullGoals(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Goal, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, user_id, type_id, exercise_id, metric_weight, reps, unit, title,
		       target_date::text, sort_order, distance, duration_seconds, start_date::text, last_modified, is_deleted
		FROM goals WHERE user_id = $1 AND last_modified > $2`,
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Goal
	for rows.Next() {
		var item models.Goal
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.TypeID, &item.ExerciseID, &item.MetricWeight, &item.Reps, &item.Unit,
			&item.Title, &item.TargetDate, &item.SortOrder, &item.Distance, &item.DurationSeconds, &item.StartDate,
			&item.LastModified, &item.IsDeleted,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- MEASUREMENTS SYNC ---

func pushMeasurements(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.Measurement) error {
	query := `
		INSERT INTO measurements (id, user_id, name, unit_id, goal_type, goal_value, custom, enabled, sort_order, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			unit_id = EXCLUDED.unit_id,
			goal_type = EXCLUDED.goal_type,
			goal_value = EXCLUDED.goal_value,
			custom = EXCLUDED.custom,
			enabled = EXCLUDED.enabled,
			sort_order = EXCLUDED.sort_order,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE measurements.user_id = EXCLUDED.user_id
		  AND measurements.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.Name, item.UnitID, item.GoalType, item.GoalValue, item.Custom, item.Enabled, item.SortOrder, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullMeasurements(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.Measurement, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, name, unit_id, goal_type, goal_value, custom, enabled, sort_order, last_modified, is_deleted FROM measurements WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Measurement
	for rows.Next() {
		var item models.Measurement
		if err := rows.Scan(&item.ID, &item.UserID, &item.Name, &item.UnitID, &item.GoalType, &item.GoalValue, &item.Custom, &item.Enabled, &item.SortOrder, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- MEASUREMENT RECORDS SYNC ---

func pushMeasurementRecords(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.MeasurementRecord) error {
	query := `
		INSERT INTO measurement_records (id, user_id, measurement_id, date, time, value, comment, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4::date, $5::time, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			measurement_id = EXCLUDED.measurement_id,
			date = EXCLUDED.date,
			time = EXCLUDED.time,
			value = EXCLUDED.value,
			comment = EXCLUDED.comment,
			last_modified = EXCLUDED.last_modified,
			is_deleted = EXCLUDED.is_deleted
		WHERE measurement_records.user_id = EXCLUDED.user_id
		  AND measurement_records.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.MeasurementID, item.Date, item.Time, item.Value, item.Comment, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullMeasurementRecords(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.MeasurementRecord, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, measurement_id, date::text, time::text, value, comment, last_modified, is_deleted FROM measurement_records WHERE user_id = $1 AND last_modified > $2",
		userID, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.MeasurementRecord
	for rows.Next() {
		var item models.MeasurementRecord
		if err := rows.Scan(&item.ID, &item.UserID, &item.MeasurementID, &item.Date, &item.Time, &item.Value, &item.Comment, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- EXERCISE COMMENTS SYNC ---

func pushExerciseComments(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.ExerciseComment) error {
	query := `
		INSERT INTO exercise_comments (id, user_id, exercise_id, date, comment, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4::date, $5, $6, $7)
		ON CONFLICT (id) DO UPDATE SET
			exercise_id = EXCLUDED.exercise_id, date = EXCLUDED.date, comment = EXCLUDED.comment,
			last_modified = EXCLUDED.last_modified, is_deleted = EXCLUDED.is_deleted
		WHERE exercise_comments.user_id = EXCLUDED.user_id
		  AND exercise_comments.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.ExerciseID, item.Date, item.Comment, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullExerciseComments(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.ExerciseComment, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, exercise_id, date::text, comment, last_modified, is_deleted FROM exercise_comments WHERE user_id = $1 AND last_modified > $2",
		userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.ExerciseComment
	for rows.Next() {
		var item models.ExerciseComment
		if err := rows.Scan(&item.ID, &item.UserID, &item.ExerciseID, &item.Date, &item.Comment, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- WORKOUT TIMES SYNC ---

func pushWorkoutTimes(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.WorkoutTime) error {
	query := `
		INSERT INTO workout_times (id, user_id, date, start_time, end_time, duration_seconds, last_modified, is_deleted)
		VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			date = EXCLUDED.date, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
			duration_seconds = EXCLUDED.duration_seconds, last_modified = EXCLUDED.last_modified, is_deleted = EXCLUDED.is_deleted
		WHERE workout_times.user_id = EXCLUDED.user_id
		  AND workout_times.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.Date, item.StartTime, item.EndTime, item.DurationSeconds, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullWorkoutTimes(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.WorkoutTime, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, date::text, start_time, end_time, duration_seconds, last_modified, is_deleted FROM workout_times WHERE user_id = $1 AND last_modified > $2",
		userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.WorkoutTime
	for rows.Next() {
		var item models.WorkoutTime
		if err := rows.Scan(&item.ID, &item.UserID, &item.Date, &item.StartTime, &item.EndTime, &item.DurationSeconds, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- CUSTOM UNITS SYNC ---

func pushCustomUnits(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.CustomUnit) error {
	query := `
		INSERT INTO custom_units (id, user_id, name, abbreviation, type, conversion_to_base, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name, abbreviation = EXCLUDED.abbreviation, type = EXCLUDED.type,
			conversion_to_base = EXCLUDED.conversion_to_base, last_modified = EXCLUDED.last_modified, is_deleted = EXCLUDED.is_deleted
		WHERE custom_units.user_id = EXCLUDED.user_id
		  AND custom_units.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.Name, item.Abbreviation, item.Type, item.ConversionToBase, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullCustomUnits(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.CustomUnit, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, name, abbreviation, type, conversion_to_base, last_modified, is_deleted FROM custom_units WHERE user_id = $1 AND last_modified > $2",
		userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.CustomUnit
	for rows.Next() {
		var item models.CustomUnit
		if err := rows.Scan(&item.ID, &item.UserID, &item.Name, &item.Abbreviation, &item.Type, &item.ConversionToBase, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}

// --- GRAPH FAVOURITES SYNC ---

func pushGraphFavourites(ctx context.Context, tx pgx.Tx, userID uuid.UUID, items []models.GraphFavourite) error {
	query := `
		INSERT INTO graph_favourites (id, user_id, exercise_id, graph_type, time_period, rep_filter, last_modified, is_deleted)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			exercise_id = EXCLUDED.exercise_id, graph_type = EXCLUDED.graph_type, time_period = EXCLUDED.time_period,
			rep_filter = EXCLUDED.rep_filter, last_modified = EXCLUDED.last_modified, is_deleted = EXCLUDED.is_deleted
		WHERE graph_favourites.user_id = EXCLUDED.user_id
		  AND graph_favourites.last_modified < EXCLUDED.last_modified
	`
	for _, item := range items {
		if _, err := tx.Exec(ctx, query, item.ID, userID, item.ExerciseID, item.GraphType, item.TimePeriod, item.RepFilter, item.LastModified, item.IsDeleted); err != nil {
			return err
		}
	}
	return nil
}

func pullGraphFavourites(ctx context.Context, tx pgx.Tx, userID uuid.UUID, since time.Time) ([]models.GraphFavourite, error) {
	rows, err := tx.Query(ctx,
		"SELECT id, user_id, exercise_id, graph_type, time_period, rep_filter, last_modified, is_deleted FROM graph_favourites WHERE user_id = $1 AND last_modified > $2",
		userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.GraphFavourite
	for rows.Next() {
		var item models.GraphFavourite
		if err := rows.Scan(&item.ID, &item.UserID, &item.ExerciseID, &item.GraphType, &item.TimePeriod, &item.RepFilter, &item.LastModified, &item.IsDeleted); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, nil
}
