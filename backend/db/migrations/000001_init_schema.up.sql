-- 000001_init_schema.up.sql

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    colour INT NOT NULL,
    sort_order INT NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    exercise_type_id INT NOT NULL, -- 1: Weights, 2: Cardio
    notes TEXT,
    weight_increment DECIMAL(6,2),
    default_rest_time INT,
    weight_unit_id INT, -- 1: kg, 2: lbs
    is_favourite BOOLEAN DEFAULT FALSE NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    notes TEXT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE routine_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE routine_section_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_section_id UUID NOT NULL REFERENCES routine_sections(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    populate_sets_type INT NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE routine_section_exercise_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_section_exercise_id UUID NOT NULL REFERENCES routine_section_exercises(id) ON DELETE CASCADE,
    metric_weight DECIMAL(8,2),
    reps INT,
    sort_order INT NOT NULL,
    distance DECIMAL(8,2),
    duration_seconds INT,
    unit INT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE training_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    metric_weight DECIMAL(8,2),
    reps INT,
    unit INT,
    routine_section_exercise_set_id UUID,
    is_personal_record BOOLEAN DEFAULT FALSE NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE NOT NULL,
    distance DECIMAL(8,2),
    duration_seconds INT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE body_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    body_weight_metric DECIMAL(6,2) NOT NULL,
    body_fat DECIMAL(4,2),
    comments TEXT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE workout_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    colour INT NOT NULL,
    routine_section_id UUID REFERENCES routine_sections(id) ON DELETE SET NULL,
    auto_jump_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    rest_timer_auto_start_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE workout_group_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    routine_section_id UUID REFERENCES routine_sections(id) ON DELETE SET NULL,
    workout_group_id UUID NOT NULL REFERENCES workout_groups(id) ON DELETE CASCADE,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_id INT NOT NULL,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    metric_weight DECIMAL(8,2),
    reps INT,
    unit INT,
    title VARCHAR(255),
    target_date DATE,
    sort_order INT NOT NULL,
    distance DECIMAL(8,2),
    duration_seconds INT,
    start_date DATE,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE barbells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight DECIMAL(6,2) NOT NULL,
    unit INT NOT NULL,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE plates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight DECIMAL(6,2) NOT NULL,
    unit INT NOT NULL,
    count INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    colour INT NOT NULL,
    width_ratio DECIMAL(4,3) NOT NULL,
    height_ratio DECIMAL(4,3) NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE workout_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    comment TEXT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    CONSTRAINT unique_user_workout_comment_date UNIQUE(user_id, date)
);

CREATE TABLE measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit_id INT NOT NULL,
    goal_type INT,
    goal_value DECIMAL(6,2),
    custom BOOLEAN DEFAULT TRUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INT NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE measurement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    measurement_id UUID NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    value DECIMAL(6,2) NOT NULL,
    comment TEXT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    metric BOOLEAN DEFAULT TRUE NOT NULL,
    first_day_of_week INT DEFAULT 1 NOT NULL, -- 1: Monday, 7: Sunday
    selected_navigation_item_id INT DEFAULT 0 NOT NULL,
    weight_increment DECIMAL(4,2) DEFAULT 2.5 NOT NULL,
    body_weight_increment DECIMAL(4,2) DEFAULT 0.1 NOT NULL,
    body_weight_goal BOOLEAN DEFAULT FALSE NOT NULL,
    body_weight_goal_weight DECIMAL(6,2),
    body_weight_show_in_workout_log BOOLEAN DEFAULT TRUE NOT NULL,
    estimated_1rm_max_reps_to_include INT DEFAULT 10 NOT NULL,
    estimated_1rm_max_apply_to_graph BOOLEAN DEFAULT TRUE NOT NULL,
    track_personal_records BOOLEAN DEFAULT TRUE NOT NULL,
    mark_sets_complete BOOLEAN DEFAULT TRUE NOT NULL,
    auto_select_next_set BOOLEAN DEFAULT TRUE NOT NULL,
    keep_screen_on BOOLEAN DEFAULT FALSE NOT NULL,
    graph_show_points BOOLEAN DEFAULT TRUE NOT NULL,
    graph_show_trend_line BOOLEAN DEFAULT FALSE NOT NULL,
    graph_start_at_zero BOOLEAN DEFAULT FALSE NOT NULL,
    rest_timer_seconds INT DEFAULT 90 NOT NULL,
    rest_timer_vibrate BOOLEAN DEFAULT TRUE NOT NULL,
    rest_timer_sound BOOLEAN DEFAULT TRUE NOT NULL,
    rest_timer_volume INT DEFAULT 100 NOT NULL,
    rest_timer_auto_start BOOLEAN DEFAULT FALSE NOT NULL,
    calendar_detail_visible BOOLEAN DEFAULT TRUE NOT NULL,
    calendar_category_dots_visible BOOLEAN DEFAULT TRUE NOT NULL,
    calendar_navigation_bar_visible BOOLEAN DEFAULT TRUE NOT NULL,
    calendar_history_category_dots_visible BOOLEAN DEFAULT TRUE NOT NULL,
    calendar_history_category_names_visible BOOLEAN DEFAULT TRUE NOT NULL,
    calendar_history_sets_visible BOOLEAN DEFAULT TRUE NOT NULL,
    category_sort_order INT DEFAULT 0 NOT NULL,
    category_show_colours BOOLEAN DEFAULT TRUE NOT NULL,
    measurement_tracker_initial_load BOOLEAN DEFAULT TRUE NOT NULL,
    measurement_show_in_workout_log BOOLEAN DEFAULT TRUE NOT NULL,
    workout_graph_default_graph_type INT DEFAULT 0 NOT NULL,
    workout_graph_default_time_period INT DEFAULT 0 NOT NULL,
    analysis_breakdown_breakdown_type INT DEFAULT 0 NOT NULL,
    analysis_breakdown_time_period INT DEFAULT 0 NOT NULL,
    exercise_list_detail_type_id INT DEFAULT 0 NOT NULL,
    workout_timer_auto_start_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    workout_timer_auto_stop_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    home_screen_limit_type_id INT DEFAULT 0 NOT NULL,
    home_screen_limit_value INT DEFAULT 0 NOT NULL,
    home_screen_category_visibility_id INT DEFAULT 0 NOT NULL,
    home_screen_skip_empty_dates BOOLEAN DEFAULT FALSE NOT NULL,
    app_theme_id INT DEFAULT 0 NOT NULL,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
