CREATE TABLE IF NOT EXISTS auth_email_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('activate','reset')),
  token_hash TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','processing','accepted','failed','expired','canceled')) DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_email_queue_ready ON auth_email_queue(status,next_attempt_at,lease_until);
CREATE INDEX IF NOT EXISTS idx_auth_email_queue_token ON auth_email_queue(token_hash);
CREATE TABLE IF NOT EXISTS auth_email_pending_events (
  email_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
