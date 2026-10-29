-- Link visit-origin leads to the exact CRM customer and original visit.
-- Existing manually entered leads stay unlinked; names are not inferred.
-- @add-column-if-missing
ALTER TABLE leads ADD COLUMN tally_customer_id TEXT;
-- @add-column-if-missing
ALTER TABLE leads ADD COLUMN source_visit_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_visit ON leads(source_visit_id) WHERE source_visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_customer_owner ON leads(user_id,tally_customer_id);
