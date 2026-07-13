-- 000003_programming.up.sql
-- Additive, idempotent support for exercise guidance, richer prescriptions,
-- progression rules, and multi-week/versioned programs.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS aliases TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscles TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS regressions TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS progressions TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS substitutions TEXT;

ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS rpe DECIMAL(3,1);
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS rir DECIMAL(3,1);
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) DEFAULT 'working' NOT NULL;

ALTER TABLE routines ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS program_weeks INT DEFAULT 1 NOT NULL;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS current_week INT DEFAULT 1 NOT NULL;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE routine_sections ADD COLUMN IF NOT EXISTS week_number INT DEFAULT 1 NOT NULL;
ALTER TABLE routine_sections ADD COLUMN IF NOT EXISTS day_of_week INT;
ALTER TABLE routine_sections ADD COLUMN IF NOT EXISTS phase TEXT;

ALTER TABLE routine_section_exercises ADD COLUMN IF NOT EXISTS progression_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE routine_section_exercises ADD COLUMN IF NOT EXISTS progression_increment DECIMAL(8,2);
ALTER TABLE routine_section_exercises ADD COLUMN IF NOT EXISTS progression_reps_step INT DEFAULT 1 NOT NULL;

ALTER TABLE routine_section_exercise_sets ADD COLUMN IF NOT EXISTS min_reps INT;
ALTER TABLE routine_section_exercise_sets ADD COLUMN IF NOT EXISTS max_reps INT;
ALTER TABLE routine_section_exercise_sets ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) DEFAULT 'working' NOT NULL;
ALTER TABLE routine_section_exercise_sets ADD COLUMN IF NOT EXISTS target_rir DECIMAL(3,1);
ALTER TABLE routine_section_exercise_sets ADD COLUMN IF NOT EXISTS tempo VARCHAR(32);
ALTER TABLE routine_section_exercise_sets ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS exercises_user_name_normalized_idx
    ON exercises (user_id, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')))
    WHERE is_deleted = FALSE;

