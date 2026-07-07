-- 01_init_sqlite.sql
-- SQLite Schema for Tauri Offline Mobile client (mirrors PostgreSQL but localizes data structures and adds local sync metadata)

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    colour INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE exercises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    exercise_type_id INTEGER NOT NULL, -- 1: Weights, 2: Cardio
    notes TEXT,
    weight_increment REAL,
    default_rest_time INTEGER,
    weight_unit_id INTEGER, -- 1: kg, 2: lbs
    is_favourite INTEGER DEFAULT 0 NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT,
    category TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE routine_sections (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE routine_section_exercises (
    id TEXT PRIMARY KEY,
    routine_section_id TEXT NOT NULL REFERENCES routine_sections(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    populate_sets_type INTEGER NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE routine_section_exercise_sets (
    id TEXT PRIMARY KEY,
    routine_section_exercise_id TEXT NOT NULL REFERENCES routine_section_exercises(id) ON DELETE CASCADE,
    metric_weight REAL,
    reps INTEGER,
    sort_order INTEGER NOT NULL,
    distance REAL,
    duration_seconds INTEGER,
    unit INTEGER,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE training_logs (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    metric_weight REAL,
    reps INTEGER,
    unit INTEGER,
    routine_section_exercise_set_id TEXT,
    is_personal_record INTEGER DEFAULT 0 NOT NULL,
    is_complete INTEGER DEFAULT 0 NOT NULL,
    distance REAL,
    duration_seconds INTEGER,
    comment TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE body_weights (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL, -- YYYY-MM-DD
    measured_at TEXT,
    body_weight_metric REAL NOT NULL,
    body_fat REAL,
    comments TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE workout_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    colour INTEGER NOT NULL,
    routine_section_id TEXT REFERENCES routine_sections(id) ON DELETE SET NULL,
    auto_jump_enabled INTEGER DEFAULT 0 NOT NULL,
    rest_timer_auto_start_enabled INTEGER DEFAULT 0 NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE workout_group_exercises (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    routine_section_id TEXT REFERENCES routine_sections(id) ON DELETE SET NULL,
    workout_group_id TEXT NOT NULL REFERENCES workout_groups(id) ON DELETE CASCADE,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    type_id INTEGER NOT NULL,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    metric_weight REAL,
    reps INTEGER,
    unit INTEGER,
    title TEXT,
    target_date TEXT,
    sort_order INTEGER NOT NULL,
    distance REAL,
    duration_seconds INTEGER,
    start_date TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE barbells (
    id TEXT PRIMARY KEY,
    weight REAL NOT NULL,
    unit INTEGER NOT NULL,
    exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE plates (
    id TEXT PRIMARY KEY,
    weight REAL NOT NULL,
    unit INTEGER NOT NULL,
    count INTEGER NOT NULL,
    enabled INTEGER DEFAULT 1 NOT NULL,
    colour INTEGER NOT NULL,
    width_ratio REAL NOT NULL,
    height_ratio REAL NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE workout_comments (
    id TEXT PRIMARY KEY,
    date TEXT UNIQUE NOT NULL,
    comment TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE measurements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit_id INTEGER NOT NULL,
    goal_type INTEGER,
    goal_value REAL,
    custom INTEGER DEFAULT 1 NOT NULL,
    enabled INTEGER DEFAULT 1 NOT NULL,
    sort_order INTEGER NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE measurement_records (
    id TEXT PRIMARY KEY,
    measurement_id TEXT NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    value REAL NOT NULL,
    comment TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE exercise_comments (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL,
    date TEXT NOT NULL,
    comment TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE workout_times (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_seconds INTEGER,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE custom_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    type INTEGER NOT NULL,
    conversion_to_base REAL NOT NULL,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE graph_favourites (
    id TEXT PRIMARY KEY,
    exercise_id TEXT,
    graph_type INTEGER NOT NULL,
    time_period INTEGER NOT NULL,
    rep_filter TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    is_dirty INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY, -- Simple key-value store for preferences
    value TEXT
);
