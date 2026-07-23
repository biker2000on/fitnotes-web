-- 000006_api_keys.up.sql
-- Read-only integration credentials. Only a SHA-256 digest is stored; the
-- plaintext key is returned once when it is created.

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash CHAR(64) NOT NULL UNIQUE,
    access_mode VARCHAR(16) NOT NULL DEFAULT 'read_only',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT api_keys_access_mode_check CHECK (access_mode IN ('read_only'))
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_active_hash_idx
    ON api_keys (key_hash)
    WHERE revoked_at IS NULL;
