-- Nullable metadata preserves legacy check-in evidence without guessing accuracy.
ALTER TABLE attendance ADD COLUMN gps_accuracy_meters REAL;
ALTER TABLE attendance ADD COLUMN gps_captured_at TEXT;
ALTER TABLE attendance ADD COLUMN location_address TEXT;
ALTER TABLE attendance ADD COLUMN location_address_status TEXT;
ALTER TABLE attendance ADD COLUMN location_address_provider TEXT;
ALTER TABLE attendance ADD COLUMN location_address_resolved_at TEXT;
CREATE TABLE IF NOT EXISTS check_in_geocode_cache (
  cache_key TEXT PRIMARY KEY,
  address TEXT,
  expires_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS check_in_geocode_rate (
  provider TEXT PRIMARY KEY,
  next_start_ms INTEGER NOT NULL
);
