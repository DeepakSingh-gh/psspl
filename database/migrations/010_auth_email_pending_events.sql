-- Repair databases that applied the queue migration before pending webhook
-- events were included. Fresh databases already have this table from 009.
CREATE TABLE IF NOT EXISTS auth_email_pending_events (
  email_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
