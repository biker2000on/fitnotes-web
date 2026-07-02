-- 000002_parity.up.sql
-- Additive, idempotent migration for feature-parity work. Safe to run on every boot.

ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS distance_unit INT DEFAULT 1 NOT NULL; -- 1: km, 2: mi
ALTER TABLE body_weights ADD COLUMN IF NOT EXISTS measured_at TIMESTAMP WITH TIME ZONE;
UPDATE body_weights SET measured_at = date::timestamp AT TIME ZONE 'UTC' WHERE measured_at IS NULL;

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

CREATE TABLE IF NOT EXISTS withings_oauth_states (
    state UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS withings_tokens (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    withings_user_id VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_update BIGINT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE withings_tokens ADD COLUMN IF NOT EXISTS last_update BIGINT DEFAULT 0 NOT NULL;

-- Routine completion links: records which routine (and which workout-day split)
-- was loaded onto a calendar date, so "how many times did I do X day" is answerable.
CREATE TABLE IF NOT EXISTS workout_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    routine_section_id UUID REFERENCES routine_sections(id) ON DELETE CASCADE,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- OIDC single sign-on (Pocket ID): identity columns on users + transaction state.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_subject VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_issuer VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'password' NOT NULL; -- password | oidc | both
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_identity_idx ON users (oidc_issuer, oidc_subject) WHERE oidc_subject IS NOT NULL;

CREATE UNLOGGED TABLE IF NOT EXISTS oidc_states (
    state VARCHAR(255) PRIMARY KEY,
    code_verifier TEXT NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    link_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    redirect_to TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
ALTER TABLE IF EXISTS oidc_states SET UNLOGGED;
