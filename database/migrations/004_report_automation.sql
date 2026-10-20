-- Additive only. Apply during a separately approved deployment, never during development against client data.
CREATE TABLE IF NOT EXISTS report_schedules (
 id TEXT PRIMARY KEY, recipient_user_id TEXT NOT NULL, phone TEXT NOT NULL,
 cadence TEXT NOT NULL CHECK(cadence IN ('daily','monthly')), send_time TEXT NOT NULL,
 template_name TEXT NOT NULL, language TEXT NOT NULL, approval_reference TEXT NOT NULL,
 opted_in INTEGER NOT NULL DEFAULT 0, template_approved INTEGER NOT NULL DEFAULT 0,
 enabled INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS report_deliveries (
 id TEXT PRIMARY KEY, schedule_id TEXT NOT NULL, period_from TEXT NOT NULL, period_to TEXT NOT NULL,
 status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT,
 provider_message_id TEXT UNIQUE, error_code TEXT, updated_at TEXT NOT NULL,
 UNIQUE(schedule_id,period_from,period_to)
);

CREATE UNIQUE INDEX IF NOT EXISTS report_recipient_cadence ON report_schedules(recipient_user_id,cadence);
CREATE TABLE IF NOT EXISTS report_status_events (
 provider_message_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL
);
