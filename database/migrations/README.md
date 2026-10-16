# Database migrations

Migration files are applied in filename order and recorded in the `schema_migrations` table.

- Never edit a migration after it has been shared.
- Add a new numbered SQL file for every schema change, for example `002_add_customer_category.sql`.
- Never add client, Tally, production, password or personal data to migrations.
- Test migrations against a new temporary database before committing them.

### Core Schema Migrations & Tables
- `001_initial_schema.sql`: Core users, salesperson profiles, visits, leads, tally integration, and billing tables.
- `thrust_products` (applied via `server/db.mjs` migration): Strategic annual priority chemical products tracking table (`id`, `name`, `alias_keywords`, `sort_order`, `active`, `created_at`).
- `dormant_reasons` (applied via `server/db.mjs` migration): Customer disengagement logging and justification records.
- `rm_weekly_purchases` (applied via `server/db.mjs` & `scripts/seed_anil_jena_realtime.mjs`): 4-week monthly purchase achievement storage per RM.
- `rm_historical_monthly_performance` (applied via `server/db.mjs` & seeder): Multi-year historical targets and actual sales per month per RM.
- `salesperson_profiles` additions: `operating_city`, `reg_code_1`, `reg_code_2` for formal registration and operating base tracking.
- `tally_payments_live` (applied via `server/db.mjs`): Real-time collection receipts (`id`, `company_name`, `voucher_guid`, `voucher_number`, `payment_date`, `payment_type`, `customer_id`, `customer_name`, `amount`, `reference`, `source_sync_id`).
- `tally_purchases` & `tally_purchase_lines` (applied via `server/db.mjs`): Chemical raw material supplier procurement vouchers and line items (`supplier_name`, `quantity`, `rate`, `amount`, `uom`).
- `tally_import_metadata` (applied via `server/db.mjs`): Ingestion sync cursors and transaction boundaries (`key`, `value`).
- `tally_customers.owner_user_id` (applied via `server/db.mjs`): Direct sales representative ownership mapping for portfolio scoping.
- High-performance composite indexes: `idx_tally_payments_date_customer`, `idx_tally_purchases_date_supplier`, `idx_tally_purchase_lines_product`, `idx_tally_customers_owner_user_id`, `idx_tally_customers_rm_name`, `idx_tally_invoices_session_date`, `idx_tally_invoice_lines_inv_prod`, `idx_tally_rm_product_sales_rm`.

Run migrations with `npm run db:migrate` or initialize with `npm run db:setup`.

### Cloud & Ephemeral Baseline Auto-Restore
For ephemeral cloud environments (e.g., Render, Docker, or fresh developer clones), `server/db.mjs` automatically restores a full pre-seeded baseline dataset from `data/crm-baseline.sqlite.gz` (compressed 8.6 MB, expanding to 57 MB SQLite) if `data/crm.sqlite` is not present at server startup. All 171 customers, 666 products, and historical billing transactions are restored seamlessly without requiring external manual steps.

