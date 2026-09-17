-- Do not backfill: last_modified is not a completion timestamp.
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
