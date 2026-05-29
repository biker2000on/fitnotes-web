package db

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type defaultCategory struct {
	ID        int
	Name      string
	Colour    int
	SortOrder int
}

type defaultExercise struct {
	Name            string
	CategoryID      int
	ExerciseTypeID  int
	Notes           string
	WeightIncrement float64
	DefaultRestTime int
	WeightUnitID    int
	IsFavourite     bool
}

var defaultCategories = []defaultCategory{
	{ID: 1, Name: "Shoulders", Colour: -7453523, SortOrder: 0},
	{ID: 2, Name: "Triceps", Colour: -14176672, SortOrder: 0},
	{ID: 3, Name: "Biceps", Colour: -812014, SortOrder: 0},
	{ID: 4, Name: "Chest", Colour: -4179669, SortOrder: 0},
	{ID: 5, Name: "Back", Colour: -14057287, SortOrder: 0},
	{ID: 6, Name: "Legs", Colour: -11226442, SortOrder: 0},
	{ID: 7, Name: "Abs", Colour: -13877680, SortOrder: 0},
	{ID: 8, Name: "Cardio", Colour: -8418163, SortOrder: 0},
}

var defaultExercises = []defaultExercise{
	{Name: "Overhead Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Dumbbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Lateral Dumbbell Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Front Dumbbell Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Push Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Behind The Neck Barbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Hammer Strength Shoulder Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Dumbbell Lateral Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Lateral Machine Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Rear Delt Dumbbell Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Rear Delt Machine Fly", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Arnold Dumbbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "One-Arm Standing Dumbbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Cable Face Pull", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Log Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Smith Machine Overhead Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Close Grip Barbell Bench Press", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "V-Bar Push Down", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Parallel Bar Triceps Dip", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Lying Triceps Extension", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Rope Push Down", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Cable Overhead Triceps Extension", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "EZ-Bar Skullcrusher", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dumbbell Overhead Triceps Extension", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Ring Dip", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Smith Machine Close Grip Bench Press", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "EZ-Bar Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dumbbell Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Incline Dumbbell Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Machine Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dumbbell Hammer Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Cable Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "EZ-Bar Preacher Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dumbbell Concentration Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dumbbell Preacher Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Flat Barbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Flat Dumbbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Incline Barbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Decline Barbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Incline Dumbbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Flat Dumbbell Fly", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Incline Dumbbell Fly", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Cable Crossover", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Incline Hammer Strength Chest Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Decline Hammer Strength Chest Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Machine Fly", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Deadlift", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Pull Up", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Chin Up", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Neutral Chin Up", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dumbbell Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Pendlay Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Lat Pulldown", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Hammer Strength Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Cable Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "T-Bar Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Shrug", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Machine Shrug", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Straight-Arm Cable Pushdown", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Rack Pull", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Good Morning", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Squat", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Front Squat", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Leg Press", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Leg Extension Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Leg Curl Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Standing Calf Raise Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Donkey Calf Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Calf Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Barbell Glute Bridge", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Glute-Ham Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Lying Leg Curl Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Romanian Deadlift", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Stiff-Legged Deadlift", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Sumo Deadlift", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Seated Calf Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Ab-Wheel Rollout", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Cable Crunch", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Crunch", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Crunch Machine", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Decline Crunch", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Dragon Flag", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Garhammer", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Hanging Leg Raise", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Plank", CategoryID: 7, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Side Plank", CategoryID: 7, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Cycling", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Walking", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Rowing Machine", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Stationary Bike", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Swimming", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Running (Treadmill)", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Running (Outdoor)", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
	{Name: "Elliptical Trainer", CategoryID: 8, ExerciseTypeID: 1, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false},
}

// defaultMeasurement describes a body measurement seeded for new users.
// unit_id: 1 = cm, 2 = inches, 3 = percent.
type defaultMeasurement struct {
	Name   string
	UnitID int
}

var defaultMeasurements = []defaultMeasurement{
	{Name: "Body Fat", UnitID: 3},
	{Name: "Neck", UnitID: 1},
	{Name: "Shoulders", UnitID: 1},
	{Name: "Chest", UnitID: 1},
	{Name: "Waist", UnitID: 1},
	{Name: "Hips", UnitID: 1},
	{Name: "Thigh", UnitID: 1},
	{Name: "Calf", UnitID: 1},
	{Name: "Bicep", UnitID: 1},
	{Name: "Forearm", UnitID: 1},
}

// SeedDefaultData seeds the 8 default categories and 96 default exercises for a newly registered user
func SeedDefaultData(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error {
	catMap := make(map[int]uuid.UUID)

	// Seed Categories
	for _, cat := range defaultCategories {
		newID := uuid.New()
		catMap[cat.ID] = newID

		_, err := tx.Exec(ctx, `
			INSERT INTO categories (id, user_id, name, colour, sort_order, last_modified, is_deleted)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, newID, userID, cat.Name, cat.Colour, cat.SortOrder, time.Now().UTC(), false)
		if err != nil {
			return err
		}
	}

	// Seed Exercises
	for _, ex := range defaultExercises {
		newID := uuid.New()
		var mappedCatID interface{} = nil
		if uuidVal, ok := catMap[ex.CategoryID]; ok {
			mappedCatID = uuidVal
		}

		_, err := tx.Exec(ctx, `
			INSERT INTO exercises (
				id, user_id, name, category_id, exercise_type_id, notes, 
				weight_increment, default_rest_time, weight_unit_id, is_favourite, last_modified, is_deleted
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, newID, userID, ex.Name, mappedCatID, ex.ExerciseTypeID, ex.Notes,
			ex.WeightIncrement, ex.DefaultRestTime, ex.WeightUnitID, ex.IsFavourite, time.Now().UTC(), false)
		if err != nil {
			return err
		}
	}

	// Seed default body measurements (custom = false so they are not user-deletable).
	for i, m := range defaultMeasurements {
		_, err := tx.Exec(ctx, `
			INSERT INTO measurements (id, user_id, name, unit_id, custom, enabled, sort_order, last_modified, is_deleted)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, uuid.New(), userID, m.Name, m.UnitID, false, true, i, time.Now().UTC(), false)
		if err != nil {
			return err
		}
	}

	return nil
}
