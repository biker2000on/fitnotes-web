import { pgTable, serial, uuid, boolean, integer, real } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Units
  metric: boolean('metric').notNull().default(true),
  firstDayOfWeek: integer('first_day_of_week').notNull().default(2),
  weightIncrement: integer('weight_increment').notNull().default(2500),

  // Body Weight
  bodyWeightIncrement: real('body_weight_increment'),
  bodyWeightGoal: integer('body_weight_goal'),
  bodyWeightGoalWeight: integer('body_weight_goal_weight'),
  bodyWeightShowInWorkoutLog: boolean('body_weight_show_in_workout_log').default(false),

  // 1RM Calculation
  estimated1rmMaxRepsToInclude: integer('estimated_1rm_max_reps_to_include').default(10),
  estimated1rmMaxApplyToGraph: boolean('estimated_1rm_max_apply_to_graph').default(false),

  // Workout Logging
  trackPersonalRecords: boolean('track_personal_records').notNull().default(true),
  markSetsComplete: boolean('mark_sets_complete').notNull().default(true),
  autoSelectNextSet: boolean('auto_select_next_set').default(true),
  keepScreenOn: boolean('keep_screen_on').default(true),

  // Graphs
  graphShowPoints: boolean('graph_show_points').default(true),
  graphShowTrendLine: boolean('graph_show_trend_line').default(true),
  graphStartAtZero: boolean('graph_start_at_zero').default(false),

  // Rest Timer
  restTimerSeconds: integer('rest_timer_seconds').notNull().default(90),
  restTimerVibrate: boolean('rest_timer_vibrate').default(true),
  restTimerSound: boolean('rest_timer_sound').default(true),
  restTimerVolume: real('rest_timer_volume').default(0.5),
  restTimerAutoStart: boolean('rest_timer_auto_start').default(false),

  // Calendar
  calendarDetailVisible: boolean('calendar_detail_visible').default(true),
  calendarCategoryDotsVisible: boolean('calendar_category_dots_visible').default(true),
  calendarNavigationBarVisible: boolean('calendar_navigation_bar_visible').default(true),
  calendarHistoryCategoryDotsVisible: boolean('calendar_history_category_dots_visible').default(true),
  calendarHistoryCategoryNamesVisible: boolean('calendar_history_category_names_visible').default(true),
  calendarHistorySetsVisible: boolean('calendar_history_sets_visible').default(true),

  // Categories
  categorySortOrder: integer('category_sort_order').default(0),
  categoryShowColours: boolean('category_show_colours').default(true),

  // Measurement Tracker
  measurementTrackerInitialLoad: boolean('measurement_tracker_initial_load').default(false),
  measurementShowInWorkoutLog: boolean('measurement_show_in_workout_log').default(false),

  // Graph Defaults
  workoutGraphDefaultGraphType: integer('workout_graph_default_graph_type').default(0),
  workoutGraphDefaultTimePeriod: integer('workout_graph_default_time_period').default(0),

  // Analysis
  analysisBreakdownBreakdownType: integer('analysis_breakdown_breakdown_type').default(0),
  analysisBreakdownTimePeriod: integer('analysis_breakdown_time_period').default(0),

  // Exercise List
  exerciseListDetailTypeId: integer('exercise_list_detail_type_id').default(0),

  // Workout Timer
  workoutTimerAutoStartEnabled: boolean('workout_timer_auto_start_enabled').default(false),
  workoutTimerAutoStopEnabled: boolean('workout_timer_auto_stop_enabled').default(false),

  // Home Screen
  homeScreenLimitTypeId: integer('home_screen_limit_type_id').default(0),
  homeScreenLimitValue: integer('home_screen_limit_value').default(7),
  homeScreenCategoryVisibilityId: integer('home_screen_category_visibility_id').default(3),
  homeScreenSkipEmptyDates: boolean('home_screen_skip_empty_dates').default(false),

  // Theme
  appThemeId: integer('app_theme_id').default(0),
});
