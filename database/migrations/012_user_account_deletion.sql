-- Retain the user identity referenced by CRM history while removing sign-in access.
-- @add-column-if-missing
ALTER TABLE users ADD COLUMN deleted_at TEXT;
