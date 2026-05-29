-- 000002_parity.up.sql
-- Additive, idempotent migration for feature-parity work. Safe to run on every boot.

ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS distance_unit INT DEFAULT 1 NOT NULL; -- 1: km, 2: mi

CREATE TABLE IF NOT EXISTS exercise_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    comment TEXT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    CONSTRAINT unique_exercise_comment UNIQUE (user_id, exercise_id, date)
);

CREATE TABLE IF NOT EXISTS workout_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    CONSTRAINT unique_workout_time UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS custom_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(32) NOT NULL,
    type INT NOT NULL, -- 1: weight, 2: length
    conversion_to_base DECIMAL(12,6) NOT NULL, -- multiply value by this to get base unit (kg or cm)
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS graph_favourites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    graph_type INT NOT NULL,
    time_period INT NOT NULL,
    rep_filter TEXT,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);
