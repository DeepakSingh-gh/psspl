-- Add token-free account notices while preserving every existing queued job and delivery record.

CREATE TABLE auth_email_queue_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('activate','reset','account')),
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
  provider TEXT NOT NULL DEFAULT 'resend',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO auth_email_queue_next (id,user_id,purpose,token_hash,encrypted_payload,idempotency_key,expires_at,status,attempts,next_attempt_at,lease_until,last_error,created_at,updated_at,provider) SELECT id,user_id,purpose,token_hash,encrypted_payload,idempotency_key,expires_at,status,attempts,next_attempt_at,lease_until,last_error,created_at,updated_at,provider FROM auth_email_queue;

DROP TABLE auth_email_queue;

ALTER TABLE auth_email_queue_next RENAME TO auth_email_queue;

CREATE INDEX IF NOT EXISTS idx_auth_email_queue_ready ON auth_email_queue(status,next_attempt_at,lease_until);
CREATE INDEX IF NOT EXISTS idx_auth_email_queue_token ON auth_email_queue(token_hash);


CREATE TABLE auth_email_delivery_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('activate','reset','account')),
  email_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('not_configured','accepted','sent','delivered','delivery_delayed','bounced','complained','failed','unknown','suppressed')),
  last_event_type TEXT,
  event_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO auth_email_delivery_next (id,user_id,purpose,email_id,status,last_event_type,event_at,created_at,updated_at) SELECT id,user_id,purpose,email_id,status,last_event_type,event_at,created_at,updated_at FROM auth_email_delivery;

DROP TABLE auth_email_delivery;

ALTER TABLE auth_email_delivery_next RENAME TO auth_email_delivery;

CREATE INDEX IF NOT EXISTS idx_auth_email_delivery_user ON auth_email_delivery(user_id,purpose,created_at);

