-- Add nullable metadata only; never invent operating locations or registration values.
-- The migration runner checks annotated fields before executing each ADD COLUMN.
-- @add-column-if-missing
ALTER TABLE salesperson_profiles ADD COLUMN operating_city TEXT;
-- @add-column-if-missing
ALTER TABLE salesperson_profiles ADD COLUMN reg_code_1 TEXT;
-- @add-column-if-missing
ALTER TABLE salesperson_profiles ADD COLUMN reg_code_2 TEXT;
