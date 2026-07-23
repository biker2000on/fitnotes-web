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
	Name             string
	CategoryID       int
	ExerciseTypeID   int
	Notes            string
	WeightIncrement  float64
	DefaultRestTime  int
	WeightUnitID     int
	IsFavourite      bool
	PrimaryMuscles   string
	SecondaryMuscles string
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
	{Name: "Overhead Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps"},
	{Name: "Seated Dumbbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps"},
	{Name: "Lateral Dumbbell Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Side Delts", SecondaryMuscles: "Traps"},
	{Name: "Front Dumbbell Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts", SecondaryMuscles: "Side Delts, Chest"},
	{Name: "Push Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps, Quads, Glutes"},
	{Name: "Behind The Neck Barbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps"},
	{Name: "Hammer Strength Shoulder Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps"},
	{Name: "Seated Dumbbell Lateral Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Side Delts", SecondaryMuscles: "Traps"},
	{Name: "Lateral Machine Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Side Delts", SecondaryMuscles: "Traps"},
	{Name: "Rear Delt Dumbbell Raise", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Rear Delts", SecondaryMuscles: "Upper Back, Traps"},
	{Name: "Rear Delt Machine Fly", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Rear Delts", SecondaryMuscles: "Upper Back, Traps"},
	{Name: "Arnold Dumbbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps"},
	{Name: "One-Arm Standing Dumbbell Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps, Obliques"},
	{Name: "Cable Face Pull", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Rear Delts, Upper Back", SecondaryMuscles: "Traps, Biceps"},
	{Name: "Log Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps, Upper Back"},
	{Name: "Smith Machine Overhead Press", CategoryID: 1, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Front Delts, Side Delts", SecondaryMuscles: "Triceps, Traps"},
	{Name: "Close Grip Barbell Bench Press", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps, Chest", SecondaryMuscles: "Front Delts"},
	{Name: "V-Bar Push Down", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps", SecondaryMuscles: "Forearms"},
	{Name: "Parallel Bar Triceps Dip", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps, Chest", SecondaryMuscles: "Front Delts"},
	{Name: "Lying Triceps Extension", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps", SecondaryMuscles: "Forearms"},
	{Name: "Rope Push Down", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps", SecondaryMuscles: "Forearms"},
	{Name: "Cable Overhead Triceps Extension", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps", SecondaryMuscles: "Forearms"},
	{Name: "EZ-Bar Skullcrusher", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps", SecondaryMuscles: "Forearms"},
	{Name: "Dumbbell Overhead Triceps Extension", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps", SecondaryMuscles: "Forearms"},
	{Name: "Ring Dip", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps, Chest", SecondaryMuscles: "Front Delts, Abs"},
	{Name: "Smith Machine Close Grip Bench Press", CategoryID: 2, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Triceps, Chest", SecondaryMuscles: "Front Delts"},
	{Name: "Barbell Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "EZ-Bar Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Dumbbell Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Seated Incline Dumbbell Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Seated Machine Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Dumbbell Hammer Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps, Forearms", SecondaryMuscles: "Front Delts"},
	{Name: "Cable Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "EZ-Bar Preacher Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Dumbbell Concentration Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Dumbbell Preacher Curl", CategoryID: 3, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Biceps", SecondaryMuscles: "Forearms"},
	{Name: "Flat Barbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Front Delts, Triceps"},
	{Name: "Flat Dumbbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Front Delts, Triceps"},
	{Name: "Incline Barbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest, Front Delts", SecondaryMuscles: "Triceps"},
	{Name: "Decline Barbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Triceps, Front Delts"},
	{Name: "Incline Dumbbell Bench Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest, Front Delts", SecondaryMuscles: "Triceps"},
	{Name: "Flat Dumbbell Fly", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Front Delts"},
	{Name: "Incline Dumbbell Fly", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Front Delts"},
	{Name: "Cable Crossover", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Front Delts"},
	{Name: "Incline Hammer Strength Chest Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest, Front Delts", SecondaryMuscles: "Triceps"},
	{Name: "Decline Hammer Strength Chest Press", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Triceps, Front Delts"},
	{Name: "Seated Machine Fly", CategoryID: 4, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Chest", SecondaryMuscles: "Front Delts"},
	{Name: "Deadlift", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Glutes, Hamstrings, Lower Back", SecondaryMuscles: "Quads, Traps, Forearms, Lats"},
	{Name: "Pull Up", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats", SecondaryMuscles: "Biceps, Upper Back, Forearms"},
	{Name: "Chin Up", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Biceps", SecondaryMuscles: "Upper Back, Forearms"},
	{Name: "Neutral Chin Up", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Biceps", SecondaryMuscles: "Upper Back, Forearms"},
	{Name: "Dumbbell Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Upper Back", SecondaryMuscles: "Biceps, Rear Delts, Forearms"},
	{Name: "Barbell Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Upper Back", SecondaryMuscles: "Biceps, Rear Delts, Lower Back, Forearms"},
	{Name: "Pendlay Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Upper Back", SecondaryMuscles: "Biceps, Rear Delts, Lower Back"},
	{Name: "Lat Pulldown", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats", SecondaryMuscles: "Biceps, Upper Back, Forearms"},
	{Name: "Hammer Strength Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Upper Back", SecondaryMuscles: "Biceps, Rear Delts"},
	{Name: "Seated Cable Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Upper Back", SecondaryMuscles: "Biceps, Rear Delts, Forearms"},
	{Name: "T-Bar Row", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Upper Back", SecondaryMuscles: "Biceps, Rear Delts, Lower Back"},
	{Name: "Barbell Shrug", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Traps", SecondaryMuscles: "Forearms, Neck"},
	{Name: "Machine Shrug", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Traps", SecondaryMuscles: "Forearms, Neck"},
	{Name: "Straight-Arm Cable Pushdown", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats", SecondaryMuscles: "Triceps, Abs"},
	{Name: "Rack Pull", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Glutes, Lower Back", SecondaryMuscles: "Hamstrings, Traps, Forearms, Lats"},
	{Name: "Good Morning", CategoryID: 5, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Hamstrings, Glutes, Lower Back", SecondaryMuscles: "Abs"},
	{Name: "Barbell Squat", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Glutes", SecondaryMuscles: "Hamstrings, Adductors, Lower Back, Abs"},
	{Name: "Barbell Front Squat", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads", SecondaryMuscles: "Glutes, Adductors, Abs, Upper Back"},
	{Name: "Leg Press", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Glutes", SecondaryMuscles: "Hamstrings, Adductors"},
	{Name: "Leg Extension Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads", SecondaryMuscles: "Hip Flexors"},
	{Name: "Seated Leg Curl Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Hamstrings", SecondaryMuscles: "Calves"},
	{Name: "Standing Calf Raise Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Calves", SecondaryMuscles: ""},
	{Name: "Donkey Calf Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Calves", SecondaryMuscles: ""},
	{Name: "Barbell Calf Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Calves", SecondaryMuscles: ""},
	{Name: "Barbell Glute Bridge", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Glutes", SecondaryMuscles: "Hamstrings, Quads"},
	{Name: "Glute-Ham Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Hamstrings, Glutes", SecondaryMuscles: "Lower Back, Calves"},
	{Name: "Lying Leg Curl Machine", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Hamstrings", SecondaryMuscles: "Calves"},
	{Name: "Romanian Deadlift", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Hamstrings, Glutes", SecondaryMuscles: "Lower Back, Forearms, Traps"},
	{Name: "Stiff-Legged Deadlift", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Hamstrings, Glutes, Lower Back", SecondaryMuscles: "Forearms, Traps"},
	{Name: "Sumo Deadlift", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Glutes, Quads, Adductors", SecondaryMuscles: "Hamstrings, Lower Back, Traps, Forearms"},
	{Name: "Seated Calf Raise", CategoryID: 6, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Calves", SecondaryMuscles: ""},
	{Name: "Ab-Wheel Rollout", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques, Lats, Hip Flexors"},
	{Name: "Cable Crunch", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques"},
	{Name: "Crunch", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques"},
	{Name: "Crunch Machine", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques"},
	{Name: "Decline Crunch", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques, Hip Flexors"},
	{Name: "Dragon Flag", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques, Hip Flexors, Lats"},
	{Name: "Garhammer", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Hip Flexors, Obliques"},
	{Name: "Hanging Leg Raise", CategoryID: 7, ExerciseTypeID: 0, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs, Hip Flexors", SecondaryMuscles: "Obliques, Forearms"},
	{Name: "Plank", CategoryID: 7, ExerciseTypeID: 5, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Abs", SecondaryMuscles: "Obliques, Lower Back"},
	{Name: "Side Plank", CategoryID: 7, ExerciseTypeID: 5, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Obliques", SecondaryMuscles: "Abs, Abductors"},
	{Name: "Cycling", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Glutes", SecondaryMuscles: "Hamstrings, Calves"},
	{Name: "Walking", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Hamstrings, Calves", SecondaryMuscles: "Glutes, Hip Flexors"},
	{Name: "Rowing Machine", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Quads", SecondaryMuscles: "Upper Back, Biceps, Hamstrings, Glutes"},
	{Name: "Stationary Bike", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Glutes", SecondaryMuscles: "Hamstrings, Calves"},
	{Name: "Swimming", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Lats, Chest", SecondaryMuscles: "Triceps, Front Delts, Upper Back"},
	{Name: "Running (Treadmill)", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Hamstrings, Calves", SecondaryMuscles: "Glutes, Hip Flexors"},
	{Name: "Running (Outdoor)", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Hamstrings, Calves", SecondaryMuscles: "Glutes, Hip Flexors"},
	{Name: "Elliptical Trainer", CategoryID: 8, ExerciseTypeID: 3, Notes: "", WeightIncrement: 2.5, DefaultRestTime: 90, WeightUnitID: 0, IsFavourite: false, PrimaryMuscles: "Quads, Glutes", SecondaryMuscles: "Hamstrings, Calves"},
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
				weight_increment, default_rest_time, weight_unit_id, is_favourite,
				primary_muscles, secondary_muscles, last_modified, is_deleted
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, newID, userID, ex.Name, mappedCatID, ex.ExerciseTypeID, ex.Notes,
			ex.WeightIncrement, ex.DefaultRestTime, ex.WeightUnitID, ex.IsFavourite,
			ex.PrimaryMuscles, ex.SecondaryMuscles, time.Now().UTC(), false)
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
