package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	AuthMethod   string    `json:"auth_method,omitempty"` // password | oidc | both
	OidcSubject  *string   `json:"-"`
	OidcIssuer   *string   `json:"-"`
	DisplayName  *string   `json:"display_name,omitempty"`
	AvatarURL    *string   `json:"avatar_url,omitempty"`
}

type Category struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Name         string    `json:"name"`
	Colour       int       `json:"colour"`
	SortOrder    int       `json:"sort_order"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type Exercise struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	Name            string     `json:"name"`
	CategoryID      *uuid.UUID `json:"category_id"`
	ExerciseTypeID  int        `json:"exercise_type_id"`
	Notes           *string    `json:"notes"`
	WeightIncrement *float64   `json:"weight_increment"`
	DefaultRestTime *int       `json:"default_rest_time"`
	WeightUnitID    *int       `json:"weight_unit_id"`
	IsFavourite     bool       `json:"is_favourite"`
	LastModified    time.Time  `json:"last_modified"`
	IsDeleted       bool       `json:"is_deleted"`
}

type Routine struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Name         string    `json:"name"`
	Notes        *string   `json:"notes"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type RoutineSection struct {
	ID           uuid.UUID `json:"id"`
	RoutineID    uuid.UUID `json:"routine_id"`
	Name         string    `json:"name"`
	SortOrder    int       `json:"sort_order"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type RoutineSectionExercise struct {
	ID               uuid.UUID `json:"id"`
	RoutineSectionID uuid.UUID `json:"routine_section_id"`
	ExerciseID       uuid.UUID `json:"exercise_id"`
	SortOrder        int       `json:"sort_order"`
	PopulateSetsType int       `json:"populate_sets_type"`
	LastModified     time.Time `json:"last_modified"`
	IsDeleted        bool      `json:"is_deleted"`
}

type RoutineSectionExerciseSet struct {
	ID                       uuid.UUID `json:"id"`
	RoutineSectionExerciseID uuid.UUID `json:"routine_section_exercise_id"`
	MetricWeight             *float64  `json:"metric_weight"`
	Reps                     *int      `json:"reps"`
	SortOrder                int       `json:"sort_order"`
	Distance                 *float64  `json:"distance"`
	DurationSeconds          *int      `json:"duration_seconds"`
	Unit                     *int      `json:"unit"`
	LastModified             time.Time `json:"last_modified"`
	IsDeleted                bool      `json:"is_deleted"`
}

type TrainingLog struct {
	ID                          uuid.UUID  `json:"id"`
	UserID                      uuid.UUID  `json:"user_id"`
	ExerciseID                  uuid.UUID  `json:"exercise_id"`
	Date                        string     `json:"date"` // YYYY-MM-DD format
	MetricWeight                *float64   `json:"metric_weight"`
	Reps                        *int       `json:"reps"`
	Unit                        *int       `json:"unit"`
	RoutineSectionExerciseSetID *uuid.UUID `json:"routine_section_exercise_set_id"`
	IsPersonalRecord            bool       `json:"is_personal_record"`
	IsComplete                  bool       `json:"is_complete"`
	Distance                    *float64   `json:"distance"`
	DurationSeconds             *int       `json:"duration_seconds"`
	Comment                     *string    `json:"comment"`
	LastModified                time.Time  `json:"last_modified"`
	IsDeleted                   bool       `json:"is_deleted"`
}

type ExerciseComment struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	ExerciseID   uuid.UUID `json:"exercise_id"`
	Date         string    `json:"date"` // YYYY-MM-DD
	Comment      *string   `json:"comment"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type WorkoutTime struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	Date            string     `json:"date"` // YYYY-MM-DD
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	DurationSeconds *int       `json:"duration_seconds"`
	LastModified    time.Time  `json:"last_modified"`
	IsDeleted       bool       `json:"is_deleted"`
}

type CustomUnit struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	Name             string    `json:"name"`
	Abbreviation     string    `json:"abbreviation"`
	Type             int       `json:"type"` // 1: weight, 2: length
	ConversionToBase float64   `json:"conversion_to_base"`
	LastModified     time.Time `json:"last_modified"`
	IsDeleted        bool      `json:"is_deleted"`
}

type GraphFavourite struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	ExerciseID   *uuid.UUID `json:"exercise_id"`
	GraphType    int        `json:"graph_type"`
	TimePeriod   int        `json:"time_period"`
	RepFilter    *string    `json:"rep_filter"`
	LastModified time.Time  `json:"last_modified"`
	IsDeleted    bool       `json:"is_deleted"`
}

type WorkoutRoutine struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	Date             string     `json:"date"` // YYYY-MM-DD
	RoutineID        uuid.UUID  `json:"routine_id"`
	RoutineSectionID *uuid.UUID `json:"routine_section_id"`
	LastModified     time.Time  `json:"last_modified"`
	IsDeleted        bool       `json:"is_deleted"`
}

type BodyWeight struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	Date             string     `json:"date"` // YYYY-MM-DD format
	MeasuredAt       *time.Time `json:"measured_at,omitempty"`
	BodyWeightMetric float64    `json:"body_weight_metric"`
	BodyFat          *float64   `json:"body_fat"`
	Comments         *string    `json:"comments"`
	LastModified     time.Time  `json:"last_modified"`
	IsDeleted        bool       `json:"is_deleted"`
}

type WorkoutGroup struct {
	ID                        uuid.UUID  `json:"id"`
	UserID                    uuid.UUID  `json:"user_id"`
	Name                      string     `json:"name"`
	Date                      string     `json:"date"` // YYYY-MM-DD
	Colour                    int        `json:"colour"`
	RoutineSectionID          *uuid.UUID `json:"routine_section_id"`
	AutoJumpEnabled           bool       `json:"auto_jump_enabled"`
	RestTimerAutoStartEnabled bool       `json:"rest_timer_auto_start_enabled"`
	LastModified              time.Time  `json:"last_modified"`
	IsDeleted                 bool       `json:"is_deleted"`
}

type WorkoutGroupExercise struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	ExerciseID       uuid.UUID  `json:"exercise_id"`
	Date             string     `json:"date"` // YYYY-MM-DD
	RoutineSectionID *uuid.UUID `json:"routine_section_id"`
	WorkoutGroupID   uuid.UUID  `json:"workout_group_id"`
	LastModified     time.Time  `json:"last_modified"`
	IsDeleted        bool       `json:"is_deleted"`
}

type Goal struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	TypeID          int       `json:"type_id"`
	ExerciseID      uuid.UUID `json:"exercise_id"`
	MetricWeight    *float64  `json:"metric_weight"`
	Reps            *int      `json:"reps"`
	Unit            *int      `json:"unit"`
	Title           *string   `json:"title"`
	TargetDate      *string   `json:"target_date"` // YYYY-MM-DD
	SortOrder       int       `json:"sort_order"`
	Distance        *float64  `json:"distance"`
	DurationSeconds *int      `json:"duration_seconds"`
	StartDate       *string   `json:"start_date"` // YYYY-MM-DD
	LastModified    time.Time `json:"last_modified"`
	IsDeleted       bool      `json:"is_deleted"`
}

type Barbell struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	Weight       float64    `json:"weight"`
	Unit         int        `json:"unit"`
	ExerciseID   *uuid.UUID `json:"exercise_id"`
	LastModified time.Time  `json:"last_modified"`
	IsDeleted    bool       `json:"is_deleted"`
}

type Plate struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Weight       float64   `json:"weight"`
	Unit         int       `json:"unit"`
	Count        int       `json:"count"`
	Enabled      bool      `json:"enabled"`
	Colour       int       `json:"colour"`
	WidthRatio   float64   `json:"width_ratio"`
	HeightRatio  float64   `json:"height_ratio"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type WorkoutComment struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Date         string    `json:"date"` // YYYY-MM-DD
	Comment      *string   `json:"comment"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type Measurement struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Name         string    `json:"name"`
	UnitID       int       `json:"unit_id"`
	GoalType     *int      `json:"goal_type"`
	GoalValue    *float64  `json:"goal_value"`
	Custom       bool      `json:"custom"`
	Enabled      bool      `json:"enabled"`
	SortOrder    int       `json:"sort_order"`
	LastModified time.Time `json:"last_modified"`
	IsDeleted    bool      `json:"is_deleted"`
}

type MeasurementRecord struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	MeasurementID uuid.UUID `json:"measurement_id"`
	Date          string    `json:"date"` // YYYY-MM-DD
	Time          string    `json:"time"` // HH:MM:SS
	Value         float64   `json:"value"`
	Comment       *string   `json:"comment"`
	LastModified  time.Time `json:"last_modified"`
	IsDeleted     bool      `json:"is_deleted"`
}

type Settings struct {
	UserID                              uuid.UUID `json:"user_id"`
	Metric                              bool      `json:"metric"`
	FirstDayOfWeek                      int       `json:"first_day_of_week"`
	SelectedNavigationItemID            int       `json:"selected_navigation_item_id"`
	WeightIncrement                     float64   `json:"weight_increment"`
	BodyWeightIncrement                 float64   `json:"body_weight_increment"`
	BodyWeightGoal                      bool      `json:"body_weight_goal"`
	BodyWeightGoalWeight                *float64  `json:"body_weight_goal_weight"`
	BodyWeightShowInWorkoutLog          bool      `json:"body_weight_show_in_workout_log"`
	Estimated1RMMaxRepsToInclude        int       `json:"estimated_1rm_max_reps_to_include"`
	Estimated1RMMaxApplyToGraph         bool      `json:"estimated_1rm_max_apply_to_graph"`
	TrackPersonalRecords                bool      `json:"track_personal_records"`
	MarkSetsComplete                    bool      `json:"mark_sets_complete"`
	AutoSelectNextSet                   bool      `json:"auto_select_next_set"`
	KeepScreenOn                        bool      `json:"keep_screen_on"`
	GraphShowPoints                     bool      `json:"graph_show_points"`
	GraphShowTrendLine                  bool      `json:"graph_show_trend_line"`
	GraphStartAtZero                    bool      `json:"graph_start_at_zero"`
	RestTimerSeconds                    int       `json:"rest_timer_seconds"`
	RestTimerVibrate                    bool      `json:"rest_timer_vibrate"`
	RestTimerSound                      bool      `json:"rest_timer_sound"`
	RestTimerVolume                     int       `json:"rest_timer_volume"`
	RestTimerAutoStart                  bool      `json:"rest_timer_auto_start"`
	CalendarDetailVisible               bool      `json:"calendar_detail_visible"`
	CalendarCategoryDotsVisible         bool      `json:"calendar_category_dots_visible"`
	CalendarNavigationBarVisible        bool      `json:"calendar_navigation_bar_visible"`
	CalendarHistoryCategoryDotsVisible  bool      `json:"calendar_history_category_dots_visible"`
	CalendarHistoryCategoryNamesVisible bool      `json:"calendar_history_category_names_visible"`
	CalendarHistorySetsVisible          bool      `json:"calendar_history_sets_visible"`
	CategorySortOrder                   int       `json:"category_sort_order"`
	CategoryShowColours                 bool      `json:"category_show_colours"`
	MeasurementTrackerInitialLoad       bool      `json:"measurement_tracker_initial_load"`
	MeasurementShowInWorkoutLog         bool      `json:"measurement_show_in_workout_log"`
	WorkoutGraphDefaultGraphType        int       `json:"workout_graph_default_graph_type"`
	WorkoutGraphDefaultTimePeriod       int       `json:"workout_graph_default_time_period"`
	AnalysisBreakdownBreakdownType      int       `json:"analysis_breakdown_breakdown_type"`
	AnalysisBreakdownTimePeriod         int       `json:"analysis_breakdown_time_period"`
	ExerciseListDetailTypeID            int       `json:"exercise_list_detail_type_id"`
	WorkoutTimerAutoStartEnabled        bool      `json:"workout_timer_auto_start_enabled"`
	WorkoutTimerAutoStopEnabled         bool      `json:"workout_timer_auto_stop_enabled"`
	HomeScreenLimitTypeID               int       `json:"home_screen_limit_type_id"`
	HomeScreenLimitValue                int       `json:"home_screen_limit_value"`
	HomeScreenCategoryVisibilityID      int       `json:"home_screen_category_visibility_id"`
	HomeScreenSkipEmptyDates            bool      `json:"home_screen_skip_empty_dates"`
	AppThemeID                          int       `json:"app_theme_id"`
	DistanceUnit                        int       `json:"distance_unit"`
	LastModified                        time.Time `json:"last_modified"`
}
