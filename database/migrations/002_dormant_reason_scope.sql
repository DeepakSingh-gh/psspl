-- Store RM notes used by the dormant-customer workflow and index team-scoped reads.
CREATE TABLE IF NOT EXISTS dormant_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  rm_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dormant_reasons_customer_rm_created
  ON dormant_reasons(customer_id, rm_id, created_at);
