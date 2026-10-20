-- Keep user mobile contact details optional; existing accounts remain unchanged.
-- @add-column-if-missing
ALTER TABLE salesperson_profiles ADD COLUMN mobile_number TEXT;
