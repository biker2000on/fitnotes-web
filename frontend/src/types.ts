// types.ts - Shared domain types matching backend/models/models.go and the DB schema.

export interface Category {
  id: string;
  name: string;
  colour: number; // ARGB integer
  sort_order: number;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_type_id: number; // see getExerciseTypeLabel
  notes?: string;
  weight_increment?: number;
  default_rest_time?: number;
  weight_unit_id?: number;
  is_favourite: boolean;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface TrainingLog {
  id: string;
  exercise_id: string;
  date: string;
  metric_weight: number | null;
  reps: number | null;
  unit: number | null;
  is_personal_record: boolean;
  is_complete: boolean;
  distance: number | null;
  duration_seconds: number | null;
  comment?: string | null;
  routine_section_exercise_set_id?: string | null;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface ExerciseComment {
  id: string;
  exercise_id: string;
  date: string;
  comment: string | null;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface WorkoutTime {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface CustomUnit {
  id: string;
  name: string;
  abbreviation: string;
  type: number; // 1 weight, 2 length
  conversion_to_base: number;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface GraphFavourite {
  id: string;
  exercise_id: string | null;
  graph_type: number;
  time_period: number;
  rep_filter: string | null;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface BodyWeight {
  id: string;
  date: string;
  body_weight_metric: number;
  body_fat: number | null;
  comments?: string;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface WorkoutComment {
  id: string;
  date: string;
  comment: string;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface WorkoutGroup {
  id: string;
  name: string;
  date: string;
  colour: number;
  routine_section_id?: string | null;
  auto_jump_enabled: boolean;
  rest_timer_auto_start_enabled: boolean;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface WorkoutGroupExercise {
  id: string;
  exercise_id: string;
  date: string;
  routine_section_id?: string | null;
  workout_group_id: string;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface Routine {
  id: string;
  name: string;
  notes?: string;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface RoutineSection {
  id: string;
  routine_id: string;
  name: string;
  sort_order: number;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface RoutineSectionExercise {
  id: string;
  routine_section_id: string;
  exercise_id: string;
  sort_order: number;
  populate_sets_type: number;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface RoutineSectionExerciseSet {
  id: string;
  routine_section_exercise_id: string;
  metric_weight: number | null;
  reps: number | null;
  sort_order: number;
  distance: number | null;
  duration_seconds: number | null;
  unit: number | null;
  is_deleted?: boolean;
  is_dirty?: number;
}

// Goal type IDs (mirror FitNotes goal categories).
export const GOAL_TYPE = {
  MAX_WEIGHT: 1,
  MAX_REPS: 2,
  ESTIMATED_1RM: 3,
  TOTAL_VOLUME: 4,
  TOTAL_REPS: 5,
  MAX_DISTANCE: 6,
  MAX_DURATION: 7,
  MAX_VOLUME: 8,
  MAX_WEIGHT_FOR_REPS: 9,
  TOTAL_DISTANCE: 10,
  TOTAL_DURATION: 11,
  MAX_WORKOUT_VOLUME: 12,
  MAX_WORKOUT_REPS: 13,
  MAX_WORKOUT_DISTANCE: 14,
  MAX_WORKOUT_DURATION: 15,
} as const;

export interface Goal {
  id: string;
  type_id: number;
  exercise_id: string;
  metric_weight: number | null;
  reps: number | null;
  unit: number | null;
  title: string | null;
  target_date: string | null;
  sort_order: number;
  distance: number | null;
  duration_seconds: number | null;
  start_date: string | null;
  is_deleted?: boolean;
  is_dirty?: number;
}

export interface Measurement {
  id: string;
  name: string;
  unit_id: number;
  goal_type: number | null;
  goal_value: number | null;
  custom: boolean;
  enabled: boolean;
  sort_order: number;
  is_deleted?: boolean;
  is_dirty?: number;
}

// Settings is a per-user singleton mirroring the backend Settings model.
export interface Settings {
  metric: boolean;
  first_day_of_week: number; // 1 Sun, 2 Mon, 7 Sat (FitNotes convention)
  selected_navigation_item_id: number;
  weight_increment: number;
  body_weight_increment: number;
  body_weight_goal: boolean;
  body_weight_goal_weight: number | null;
  body_weight_show_in_workout_log: boolean;
  estimated_1rm_max_reps_to_include: number;
  estimated_1rm_max_apply_to_graph: boolean;
  track_personal_records: boolean;
  mark_sets_complete: boolean;
  auto_select_next_set: boolean;
  keep_screen_on: boolean;
  graph_show_points: boolean;
  graph_show_trend_line: boolean;
  graph_start_at_zero: boolean;
  rest_timer_seconds: number;
  rest_timer_vibrate: boolean;
  rest_timer_sound: boolean;
  rest_timer_volume: number;
  rest_timer_auto_start: boolean;
  calendar_detail_visible: boolean;
  calendar_category_dots_visible: boolean;
  calendar_navigation_bar_visible: boolean;
  calendar_history_category_dots_visible: boolean;
  calendar_history_category_names_visible: boolean;
  calendar_history_sets_visible: boolean;
  category_sort_order: number;
  category_show_colours: boolean;
  measurement_tracker_initial_load: boolean;
  measurement_show_in_workout_log: boolean;
  workout_graph_default_graph_type: number;
  workout_graph_default_time_period: number;
  analysis_breakdown_breakdown_type: number;
  analysis_breakdown_time_period: number;
  exercise_list_detail_type_id: number;
  workout_timer_auto_start_enabled: boolean;
  workout_timer_auto_stop_enabled: boolean;
  home_screen_limit_type_id: number;
  home_screen_limit_value: number;
  home_screen_category_visibility_id: number;
  home_screen_skip_empty_dates: boolean;
  app_theme_id: number;
  distance_unit: number; // 1 km, 2 mi
  last_modified?: string;
  is_dirty?: number;
}

export interface MeasurementRecord {
  id: string;
  measurement_id: string;
  date: string;
  time: string; // HH:MM:SS
  value: number;
  comment: string | null;
  is_deleted?: boolean;
  is_dirty?: number;
}
