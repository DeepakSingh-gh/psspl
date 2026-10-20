CREATE TABLE lead_stage_history (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  previous_stage TEXT NOT NULL,
  new_stage TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_stage_history_lead_changed
  ON lead_stage_history(lead_id, changed_at);
