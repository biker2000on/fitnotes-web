# FitNotes Database Schema Reference

## Original SQLite Schema (from FitNotes backup)

This document provides the exact schema extracted from the FitNotes SQLite backup for reference during implementation.

---

## Core Tables

### exercise
```sql
CREATE TABLE exercise(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  exercise_type_id INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  weight_increment INTEGER,        -- grams
  default_graph_id INTEGER,
  default_rest_time INTEGER,       -- seconds
  weight_unit_id INTEGER NOT NULL DEFAULT 0,
  is_favourite INTEGER NOT NULL DEFAULT 0
);
```

### training_log
```sql
CREATE TABLE training_log (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL,
  date DATE NOT NULL,              -- YYYY-MM-DD format
  metric_weight INTEGER NOT NULL,  -- grams
  reps INTEGER NOT NULL,
  unit INTEGER NOT NULL DEFAULT 0, -- 0=default, 1=kg, 2=lbs
  routine_section_exercise_set_id INTEGER NOT NULL DEFAULT 0,
  timer_auto_start INTEGER NOT NULL DEFAULT 0,
  is_personal_record INTEGER NOT NULL DEFAULT 0,
  is_personal_record_first INTEGER NOT NULL DEFAULT 0,
  is_complete INTEGER NOT NULL DEFAULT 0,
  is_pending_update INTEGER NOT NULL DEFAULT 0,
  distance INTEGER NOT NULL DEFAULT 0,        -- meters
  duration_seconds INTEGER NOT NULL DEFAULT 0
);
```

### Category
```sql
CREATE TABLE Category(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  colour INTEGER NOT NULL DEFAULT 0,  -- ARGB integer
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

---

## Routine Tables

### Routine
```sql
CREATE TABLE Routine(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  notes TEXT
);
```

### RoutineSection
```sql
CREATE TABLE RoutineSection(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT '0'
);
```

### RoutineSectionExercise
```sql
CREATE TABLE RoutineSectionExercise(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_section_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  populate_sets_type INTEGER NOT NULL DEFAULT 0
);
```

### RoutineSectionExerciseSet
```sql
CREATE TABLE RoutineSectionExerciseSet(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_section_exercise_id INTEGER NOT NULL,
  metric_weight INTEGER NOT NULL,      -- grams
  reps INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  distance INTEGER NOT NULL DEFAULT 0,  -- meters
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  unit INTEGER NOT NULL DEFAULT 0
);
```

---

## Workout Organization

### WorkoutGroup (Supersets)
```sql
CREATE TABLE WorkoutGroup (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  colour INTEGER NOT NULL,
  routine_section_id INTEGER,
  auto_jump_enabled INTEGER NOT NULL DEFAULT 1,
  rest_timer_auto_start_enabled INTEGER NOT NULL DEFAULT 0
);
```

### WorkoutGroupExercise
```sql
CREATE TABLE WorkoutGroupExercise(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  routine_section_id INTEGER NOT NULL,
  workout_group_id INTEGER NOT NULL
);
```

### WorkoutTime
```sql
CREATE TABLE WorkoutTime (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_date TEXT NOT NULL,
  start_date_time TEXT NOT NULL,
  end_date_time TEXT NOT NULL
);
```

---

## Comments

### Comment
```sql
CREATE TABLE Comment (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  owner_type_id INTEGER NOT NULL,  -- 1=Set, 2=Workout
  owner_id INTEGER NOT NULL,
  comment TEXT NOT NULL
);
```

### WorkoutComment
```sql
CREATE TABLE WorkoutComment (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  comment TEXT NOT NULL
);
```

---

## Goals

### Goal
```sql
CREATE TABLE Goal (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  metric_weight INTEGER NOT NULL,  -- grams
  reps INTEGER NOT NULL,
  unit INTEGER NOT NULL,
  title TEXT,
  target_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  distance INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  start_date TEXT
);
```

---

## Body Tracker

### Measurement
```sql
CREATE TABLE Measurement (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit_id INTEGER NOT NULL DEFAULT 0,
  goal_type INTEGER NOT NULL DEFAULT 0,
  goal_value REAL NOT NULL DEFAULT 0,
  custom INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

### MeasurementRecord
```sql
CREATE TABLE MeasurementRecord (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  measurement_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  value REAL NOT NULL,
  comment TEXT
);
```

### MeasurementUnit
```sql
CREATE TABLE MeasurementUnit (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  type INTEGER NOT NULL DEFAULT 0,  -- 0=none, 1=weight, 2=length, 3=percent
  long_name TEXT NOT NULL,
  short_name TEXT NOT NULL
);
```

### BodyWeight (Legacy)
```sql
CREATE TABLE BodyWeight (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  body_weight_metric REAL NOT NULL,  -- kg
  body_fat REAL NOT NULL,            -- percentage
  comments TEXT
);
```

---

## Plate Calculator

### Barbell
```sql
CREATE TABLE Barbell (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight REAL NOT NULL,
  unit INTEGER NOT NULL DEFAULT 0,
  exercise_id INTEGER NOT NULL DEFAULT 0  -- 0 = default bar
);
```

### Plate
```sql
CREATE TABLE Plate (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight REAL NOT NULL,
  unit INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  colour INTEGER NOT NULL DEFAULT 0,
  width_ratio REAL NOT NULL DEFAULT 1,
  height_ratio REAL NOT NULL DEFAULT 1
);
```

---

## Graph Favorites

### ExerciseGraphFavourite
```sql
CREATE TABLE ExerciseGraphFavourite(
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  graph_type_id INTEGER NOT NULL DEFAULT 0,
  time_period INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);
```

### RepMaxGridFavourite
```sql
CREATE TABLE RepMaxGridFavourite (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_ids TEXT NOT NULL,   -- comma-separated
  rep_counts TEXT NOT NULL,     -- comma-separated
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

---

## Settings

### settings
```sql
CREATE TABLE settings (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Units
  metric INTEGER NOT NULL DEFAULT 0,
  first_day_of_week INTEGER NOT NULL DEFAULT 0,
  weight_increment INTEGER NOT NULL DEFAULT 0,

  -- Body Weight
  body_weight_increment REAL,
  body_weight_goal INTEGER,
  body_weight_goal_weight INTEGER,
  body_weight_show_in_workout_log INTEGER,

  -- 1RM Calculation
  estimated_1rm_max_reps_to_include INTEGER,
  estimated_1rm_max_apply_to_graph INTEGER,

  -- Workout Logging
  track_personal_records INTEGER,
  mark_sets_complete INTEGER,
  auto_select_next_set INTEGER,
  keep_screen_on INTEGER,

  -- Graphs
  graph_show_points INTEGER,
  graph_show_trend_line INTEGER,
  graph_start_at_zero INTEGER,

  -- Rest Timer
  rest_timer_seconds INTEGER,
  rest_timer_vibrate INTEGER,
  rest_timer_sound INTEGER,
  rest_timer_volume REAL,
  rest_timer_auto_start INTEGER,

  -- Calendar
  calendar_detail_visible INTEGER,
  calendar_category_dots_visible INTEGER,
  calendar_navigation_bar_visible INTEGER,
  calendar_history_category_dots_visible INTEGER,
  calendar_history_category_names_visible INTEGER,
  calendar_history_sets_visible INTEGER,

  -- Categories
  category_sort_order INTEGER,
  category_show_colours INTEGER,

  -- Measurement Tracker
  measurement_tracker_initial_load INTEGER,
  measurement_show_in_workout_log INTEGER,

  -- Graph Defaults
  workout_graph_default_graph_type INTEGER,
  workout_graph_default_time_period INTEGER,

  -- Analysis
  analysis_breakdown_breakdown_type INTEGER,
  analysis_breakdown_time_period INTEGER,

  -- Exercise List
  exercise_list_detail_type_id INTEGER,

  -- Workout Timer
  workout_timer_auto_start_enabled INTEGER,
  workout_timer_auto_stop_enabled INTEGER,

  -- Home Screen
  home_screen_limit_type_id INTEGER,
  home_screen_limit_value INTEGER,
  home_screen_category_visibility_id INTEGER,
  home_screen_skip_empty_dates INTEGER,

  -- Theme
  app_theme_id INTEGER
);
```

---

## Enumeration Values

### Exercise Types (exercise_type_id)
| ID | Name | Weight | Reps | Distance | Time |
|----|------|--------|------|----------|------|
| 0 | Weight & Reps | Yes | Yes | No | No |
| 1 | Duration Only | No | No | No | Yes |
| 2 | (Advanced - Supporter) | - | - | - | - |
| 3 | Distance & Time | No | No | Yes | Yes |

### Weight Units (unit, weight_unit_id)
| ID | Name |
|----|------|
| 0 | Default (use global setting) |
| 1 | Kilograms |
| 2 | Pounds |

### Measurement Unit Types
| ID | Type |
|----|------|
| 0 | None/Custom |
| 1 | Weight (kg/lbs) |
| 2 | Length (cm/in) |
| 3 | Percentage |

### Graph Types (graph_type_id, default_graph_id)
| ID | Graph Type |
|----|------------|
| 0 | Max Weight |
| 1 | Volume |
| 2 | Estimated 1RM |
| 3 | Max Weight for Reps |
| 4 | Personal Records |
| 5+ | Cardio variants |

### Time Periods
| ID | Period |
|----|--------|
| 0 | All Time |
| 1 | Year |
| 2 | Month |
| 3 | Week |
| 4 | Custom |

### Comment Owner Types (owner_type_id)
| ID | Owner |
|----|-------|
| 1 | Training Log Set |
| 2 | Workout |

### Goal Types (type_id)
| ID | Goal Type |
|----|-----------|
| 0 | Max Weight |
| 1 | Max Reps |
| 2 | Max Volume |
| 3 | Estimated 1RM |
| 4 | Max Weight for Reps |
| 5 | Total Distance |
| 6 | Total Duration |
| 7 | Total Reps |
| 8+ | Workout totals |

### Measurement Goal Types (goal_type)
| ID | Type |
|----|------|
| 0 | None |
| 1 | Increase |
| 2 | Decrease |
| 3 | Target Value |

### First Day of Week (first_day_of_week)
| ID | Day |
|----|-----|
| 1 | Sunday |
| 2 | Monday |
| 7 | Saturday |

### Home Screen Category Visibility (home_screen_category_visibility_id)
| ID | Visibility |
|----|------------|
| 0 | None |
| 1 | Name Only |
| 2 | Color Only |
| 3 | Both |

---

## Data Conversion Notes

### Weight Conversion
```javascript
// grams to kg
const gramsToKg = (grams) => grams / 1000;

// grams to lbs
const gramsToLbs = (grams) => grams / 453.592;

// kg to grams
const kgToGrams = (kg) => kg * 1000;

// lbs to grams
const lbsToGrams = (lbs) => Math.round(lbs * 453.592);
```

### Color Conversion
```javascript
// ARGB integer to hex string
const argbToHex = (argb) => {
  const hex = (argb & 0xFFFFFF).toString(16).padStart(6, '0');
  return `#${hex}`;
};

// Hex string to ARGB integer
const hexToArgb = (hex) => {
  const rgb = parseInt(hex.replace('#', ''), 16);
  return 0xFF000000 | rgb; // Full opacity
};
```

### Distance Conversion
```javascript
// meters to km
const metersToKm = (m) => m / 1000;

// meters to miles
const metersToMiles = (m) => m / 1609.344;

// km to meters
const kmToMeters = (km) => km * 1000;

// miles to meters
const milesToMeters = (mi) => Math.round(mi * 1609.344);
```

### 1RM Calculation (Epley Formula)
```javascript
const calculate1RM = (weight, reps) => {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
};
```

---

## Sample Data Counts

From the analyzed backup:
- **Exercises**: 268
- **Training Logs**: 3,770
- **Categories**: 13
- **Routines**: 11
