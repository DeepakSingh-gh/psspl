-- Existing accounts retain email login; no credentials, roles or assignments change.
-- @add-column-if-missing
ALTER TABLE users ADD COLUMN login_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id COLLATE NOCASE) WHERE login_id IS NOT NULL;
