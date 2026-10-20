CREATE TABLE IF NOT EXISTS auth_email_delivery (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('activate','reset')),
  email_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('not_configured','accepted','sent','delivered','delivery_delayed','bounced','complained','failed','unknown','suppressed')),
  last_event_type TEXT,
  event_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_email_delivery_user ON auth_email_delivery(user_id,purpose,created_at);
