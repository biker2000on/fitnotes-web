# FitNotes Application - Feature Documentation

## Overview

FitNotes is a comprehensive workout tracking Android application by James Gay. This document details all features extracted from the decompiled APK and database backup for the purpose of creating a PWA clone with full feature parity.

**Package**: `com.github.jamesgay.fitnotes`
**Database Stats**: 268 exercises, 3,770 training logs, 13 categories, 11 routines

---

## Table of Contents

1. [Exercise Management](#1-exercise-management)
2. [Workout Logging](#2-workout-logging)
3. [Routines (Workout Templates)](#3-routines-workout-templates)
4. [Calendar & History](#4-calendar--history)
5. [Progress Tracking & Graphs](#5-progress-tracking--graphs)
6. [Analysis & Statistics](#6-analysis--statistics)
7. [Body Tracker (Measurements)](#7-body-tracker-measurements)
8. [Goals System](#8-goals-system)
9. [Rest Timer](#9-rest-timer)
10. [Plate Calculator](#10-plate-calculator)
11. [Settings & Customization](#11-settings--customization)
12. [Backup & Data Management](#12-backup--data-management)

---

## 1. Exercise Management

### Exercise Properties
| Field | Type | Description |
|-------|------|-------------|
| `_id` | INTEGER | Primary key |
| `name` | TEXT | Exercise name |
| `category_id` | INTEGER | FK to Category |
| `exercise_type_id` | INTEGER | Type of exercise (see below) |
| `notes` | TEXT | User notes |
| `weight_increment` | INTEGER | Weight increment in grams |
| `default_graph_id` | INTEGER | Default graph view |
| `default_rest_time` | INTEGER | Default rest timer (seconds) |
| `weight_unit_id` | INTEGER | 0=default, 1=kg, 2=lbs |
| `is_favourite` | INTEGER | Boolean for quick access |

### Exercise Types
| ID | Type | Fields |
|----|------|--------|
| 0 | Weight & Reps | Weight (kg/lbs), Reps |
| 1 | Duration | Time (seconds) |
| 3 | Distance & Duration | Distance, Time |
| 2+ | Advanced (Supporter) | Various combinations |

### Categories (Muscle Groups)
Categories have: name, color (integer ARGB), and sort order.

Default categories from database:
- Shoulders, Triceps, Biceps, Chest, Back, Legs, Abs, Cardio

Custom categories can be added with custom colors.

### Features
- Create/Edit/Delete exercises
- Assign to categories (muscle groups)
- Set exercise type (determines input fields)
- Add notes to exercises
- Configure default rest timer per exercise
- Configure weight unit per exercise (override global)
- Configure weight increment per exercise
- Mark exercises as favorites
- View exercise stats (total sets, volume, etc.)

---

## 2. Workout Logging

### Training Log Properties
| Field | Type | Description |
|-------|------|-------------|
| `_id` | INTEGER | Primary key |
| `exercise_id` | INTEGER | FK to exercise |
| `date` | DATE | Workout date |
| `metric_weight` | INTEGER | Weight in grams |
| `reps` | INTEGER | Rep count |
| `unit` | INTEGER | 0=default, 1=kg, 2=lbs |
| `distance` | INTEGER | Distance in meters |
| `duration_seconds` | INTEGER | Duration in seconds |
| `is_personal_record` | INTEGER | PR flag |
| `is_personal_record_first` | INTEGER | First time PR |
| `is_complete` | INTEGER | Set completion flag |
| `is_pending_update` | INTEGER | Needs recalculation |
| `routine_section_exercise_set_id` | INTEGER | FK to routine set |
| `timer_auto_start` | INTEGER | Auto-start timer |

### Workout Time Tracking
| Field | Type | Description |
|-------|------|-------------|
| `workout_date` | TEXT | Date of workout |
| `start_date_time` | TEXT | When workout started |
| `end_date_time` | TEXT | When workout ended |

### Features
- Log sets with weight/reps for strength exercises
- Log sets with distance/time for cardio
- Mark sets as complete
- View and edit previous sets
- Copy sets from previous workouts
- Auto-populate from routine templates
- Superset support (group exercises together)
- Personal record detection and highlighting
- Add comments to workouts or individual sets
- Track workout start/end time
- Rest timer integration (auto-start after set)
- Quick exercise switching
- Set calculator (percentages of max)

### Supersets (Workout Groups)
| Field | Type | Description |
|-------|------|-------------|
| `_id` | INTEGER | Primary key |
| `name` | TEXT | Group name |
| `date` | TEXT | Workout date |
| `colour` | INTEGER | Visual indicator |
| `routine_section_id` | INTEGER | From routine |
| `auto_jump_enabled` | INTEGER | Jump between exercises |
| `rest_timer_auto_start_enabled` | INTEGER | Timer after superset |

---

## 3. Routines (Workout Templates)

### Routine Structure
```
Routine
  └── RoutineSection (e.g., "Day 1", "Push Day")
        └── RoutineSectionExercise (ordered exercises)
              └── RoutineSectionExerciseSet (predefined sets)
```

### Routine Properties
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Routine name |
| `notes` | TEXT | Description |

### Routine Section Properties
| Field | Type | Description |
|-------|------|-------------|
| `routine_id` | INTEGER | FK to routine |
| `name` | TEXT | Section name |
| `sort_order` | INTEGER | Display order |

### Routine Section Exercise Properties
| Field | Type | Description |
|-------|------|-------------|
| `routine_section_id` | INTEGER | FK to section |
| `exercise_id` | INTEGER | FK to exercise |
| `sort_order` | INTEGER | Display order |
| `populate_sets_type` | INTEGER | How to populate sets |

### Features
- Create/Edit/Delete routines
- Multiple sections per routine (split days)
- Define exercises per section with order
- Predefined sets with weight/reps
- Auto-populate workout from routine
- Reorder exercises within sections
- Choose set population method (blank, last workout, routine template)

---

## 4. Calendar & History

### Features
- Month view calendar with workout indicators
- Category dots showing muscle groups worked
- List view of workout history
- Filter by date range
- Filter by category or exercise
- Navigate between dates (swipe)
- Skip empty dates option
- View workout details for any date

### Workout Operations
- Copy workout to another date
- Move workout to another date
- Delete workout history (with filters)

### Display Options
- Show/hide category dots
- Show/hide category names
- Show/hide set details
- Show/hide navigation bar

---

## 5. Progress Tracking & Graphs

### Graph Types
| ID | Type | Description |
|----|------|-------------|
| 0 | Weight | Max weight lifted per workout |
| 1 | Volume | Total weight × reps |
| 2 | Estimated 1RM | Calculated one-rep max |
| 3 | Max Weight for Reps | Best weight for specific rep counts |
| 4 | Personal Records | PR timeline |
| 5+ | Cardio variants | Distance, time, pace/speed |

### Graph Features
- Trend lines (optional)
- Show/hide data points
- Custom date ranges
- Time periods: All, Year, Month, Week, Custom
- Y-axis from zero option
- Filter by rep count
- Default graph type per exercise

### Personal Records
| Record Type | Description |
|-------------|-------------|
| Max Weight | Highest weight lifted |
| Max Reps | Most reps at any weight |
| Max Volume | Highest weight × reps |
| Estimated 1RM | Best calculated 1RM |
| Max Distance | Longest distance |
| Max Duration | Longest time |
| Best Pace | Fastest pace/speed |

### Exercise Statistics
- Total sets performed
- Total reps performed
- Total volume (weight × reps)
- Total distance (cardio)
- Total duration (cardio)
- Last workout date
- Workout count

### Rep Max Grid
- Grid view showing estimated max for different rep ranges
- Compare multiple exercises side by side
- Save favorite grid configurations

---

## 6. Analysis & Statistics

### Breakdown Types
| Type | Description |
|------|-------------|
| By Exercise | Stats per exercise |
| By Category | Stats per muscle group |
| By Workout | Stats per workout session |

### Metrics
- Sets performed
- Reps performed
- Volume (weight × reps)
- Number of workouts
- Distance (cardio)
- Duration (cardio)

### Time Periods
- All time
- This year
- This month
- This week
- Custom date range

### Visualization
- Pie chart for category/exercise breakdown
- Sortable data tables

---

## 7. Body Tracker (Measurements)

### Measurement Properties
| Field | Type | Description |
|-------|------|-------------|
| `name` | TEXT | Measurement name |
| `unit_id` | INTEGER | FK to MeasurementUnit |
| `goal_type` | INTEGER | Increase/Decrease/Target |
| `goal_value` | REAL | Target value |
| `custom` | INTEGER | User-created vs default |
| `enabled` | INTEGER | Show in tracker |
| `sort_order` | INTEGER | Display order |

### Measurement Record Properties
| Field | Type | Description |
|-------|------|-------------|
| `measurement_id` | INTEGER | FK to measurement |
| `date` | TEXT | Record date |
| `time` | TEXT | Record time |
| `value` | REAL | Measured value |
| `comment` | TEXT | Notes |

### Measurement Units
| Type | Units |
|------|-------|
| Weight | Kilograms (kgs), Pounds (lbs) |
| Length | Centimetres (cm), Inches (in) |
| Percentage | Percent (%) |

### Features
- Track body weight (default)
- Custom measurements (chest, waist, arms, etc.)
- Record values with dates and comments
- Graph visualization of trends
- Goal setting (increase/decrease/target value)
- Unit conversion for existing data
- Show measurements in workout log (optional)
- Import/export measurement data

### Body Weight (Legacy)
Separate table for body weight tracking with body fat percentage:
| Field | Type | Description |
|-------|------|-------------|
| `date` | TEXT | Record date |
| `body_weight_metric` | REAL | Weight in kg |
| `body_fat` | REAL | Body fat percentage |
| `comments` | TEXT | Notes |

---

## 8. Goals System

### Goal Properties
| Field | Type | Description |
|-------|------|-------------|
| `type_id` | INTEGER | Goal type |
| `exercise_id` | INTEGER | FK to exercise |
| `metric_weight` | INTEGER | Target weight (grams) |
| `reps` | INTEGER | Target reps |
| `unit` | INTEGER | Weight unit |
| `title` | TEXT | Custom title |
| `target_date` | TEXT | Due date |
| `start_date` | TEXT | Start tracking |
| `distance` | INTEGER | Target distance |
| `duration_seconds` | INTEGER | Target duration |
| `sort_order` | INTEGER | Display order |

### Goal Types
| Type | Description |
|------|-------------|
| Max Weight | Lift a specific weight |
| Max Reps | Achieve rep count at weight |
| Max Volume | Volume in single set |
| Estimated 1RM | Calculated 1RM target |
| Max Weight for Reps | Weight at specific reps |
| Total Distance | Cumulative distance |
| Total Duration | Cumulative time |
| Total Reps | Cumulative reps |
| Workout Totals | Per-workout targets |
| Body Measurement | Measurement goals |

### Features
- Set exercise-specific goals
- Set date ranges (start/target date)
- Track progress vs target
- Reorder goals
- Per-exercise filtering in views

---

## 9. Rest Timer

### Settings
| Setting | Description |
|---------|-------------|
| `rest_timer_seconds` | Default duration |
| `rest_timer_vibrate` | Vibrate on complete |
| `rest_timer_sound` | Sound on complete |
| `rest_timer_volume` | Sound volume |
| `rest_timer_auto_start` | Auto-start after set |

### Features
- Configurable default duration
- Per-exercise override
- Notification-based timer
- Vibration/sound alerts
- Auto-start option after logging set
- Superset awareness (delay until round complete)
- Manual start/pause/reset
- Background service for continued operation

---

## 10. Plate Calculator

### Plate Properties
| Field | Type | Description |
|-------|------|-------------|
| `weight` | REAL | Plate weight |
| `unit` | INTEGER | kg/lbs |
| `count` | INTEGER | Available quantity |
| `enabled` | INTEGER | Include in calc |
| `colour` | INTEGER | Visual color |
| `width_ratio` | REAL | Visual width |
| `height_ratio` | REAL | Visual height |

### Barbell Properties
| Field | Type | Description |
|-------|------|-------------|
| `weight` | REAL | Bar weight |
| `unit` | INTEGER | kg/lbs |
| `exercise_id` | INTEGER | Per-exercise override |

### Features
- Calculate plates needed for target weight
- Custom plate sets with colors and dimensions
- Per-exercise barbell weight
- Visual plate representation
- Default bar weight setting

---

## 11. Settings & Customization

### Unit Settings
| Setting | Description |
|---------|-------------|
| `metric` | 0=Imperial, 1=Metric |
| `first_day_of_week` | 1=Sunday, 2=Monday, 7=Saturday |
| `weight_increment` | Default weight increment |

### Home Screen
| Setting | Description |
|---------|-------------|
| `home_screen_category_visibility_id` | Show name/color/both/none |
| `home_screen_limit_type_id` | Set display limit type |
| `home_screen_limit_value` | Number of sets to show |
| `home_screen_skip_empty_dates` | Skip dates with no workouts |

### Exercise List
| Setting | Description |
|---------|-------------|
| `exercise_list_detail_type_id` | Show last date or count |
| `category_sort_order` | Category ordering |
| `category_show_colours` | Show category colors |

### Workout Logging
| Setting | Description |
|---------|-------------|
| `track_personal_records` | PR detection enabled |
| `mark_sets_complete` | Enable completion marking |
| `auto_select_next_set` | Auto-advance to next set |
| `keep_screen_on` | Prevent screen timeout |

### Graphs
| Setting | Description |
|---------|-------------|
| `graph_show_points` | Show data points |
| `graph_show_trend_line` | Show trend line |
| `graph_start_at_zero` | Y-axis from zero |
| `workout_graph_default_graph_type` | Default graph type |
| `workout_graph_default_time_period` | Default time period |

### 1RM Calculation
| Setting | Description |
|---------|-------------|
| `estimated_1rm_max_reps_to_include` | Max reps for accuracy |
| `estimated_1rm_max_apply_to_graph` | Apply to graph display |

### Calendar
| Setting | Description |
|---------|-------------|
| `calendar_detail_visible` | Show details |
| `calendar_category_dots_visible` | Show category dots |
| `calendar_navigation_bar_visible` | Show nav bar |
| `calendar_history_category_dots_visible` | Dots in history |
| `calendar_history_category_names_visible` | Names in history |
| `calendar_history_sets_visible` | Sets in history |

### Analysis
| Setting | Description |
|---------|-------------|
| `analysis_breakdown_breakdown_type` | Default breakdown |
| `analysis_breakdown_time_period` | Default period |

### Workout Timer
| Setting | Description |
|---------|-------------|
| `workout_timer_auto_start_enabled` | Auto-start on first set |
| `workout_timer_auto_stop_enabled` | Auto-stop on exit |

### Theme
| Setting | Description |
|---------|-------------|
| `app_theme_id` | Selected theme |

---

## 12. Backup & Data Management

### Automatic Backup (Google Drive)
- Background worker for scheduled backups
- Stores 5 most recent backups
- Error notifications with retry
- Requires Google account sign-in

### Manual Backup
- Create backup with timestamp
- Share backup file
- SQLite database export

### Export Features
- Export workout data to CSV
- Export body tracker data to CSV
- Include/exclude comments option
- Date range filtering

### Restore
- Restore from automatic backups
- Restore from manual backup files
- Import SQLite database

### Delete Operations
- Delete workout history (with filters)
- Delete by date range
- Delete by category/exercise

---

## Comments System

### Comment Properties
| Field | Type | Description |
|-------|------|-------------|
| `date` | DATE | Comment date |
| `owner_type_id` | INTEGER | 1=Set, 2=Workout |
| `owner_id` | INTEGER | FK to set or workout |
| `comment` | TEXT | Comment text |

### Workout Comments (Separate)
| Field | Type | Description |
|-------|------|-------------|
| `date` | TEXT | Workout date |
| `comment` | TEXT | Comment text |

---

## Graph Favorites

### Exercise Graph Favorite
| Field | Type | Description |
|-------|------|-------------|
| `group_id` | INTEGER | Grouping |
| `exercise_id` | INTEGER | FK to exercise |
| `graph_type_id` | INTEGER | Graph type |
| `time_period` | INTEGER | Time period |
| `sort_order` | INTEGER | Display order |
| `is_default` | INTEGER | Default view |

### Rep Max Grid Favorite
| Field | Type | Description |
|-------|------|-------------|
| `exercise_ids` | TEXT | Comma-separated IDs |
| `rep_counts` | TEXT | Comma-separated reps |
| `is_default` | INTEGER | Default view |
| `sort_order` | INTEGER | Display order |
