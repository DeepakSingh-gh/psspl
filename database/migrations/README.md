# Database migrations

## 16 October 2026 update

The RM landing redirect, report tab ordering, AI-provider extraction and My Day performance work introduce no SQL migration or data rewrite. The overview query reuses existing invoice/customer indexes. Local regression checks matched product aggregates across 25 scopes; compressed and uncompressed RM/salesperson JSON matched exactly. No database import, seeding or migration was run for this documentation refresh.

Source commits are published to GitHub and the frontend is live, but the new backend query/compression implementation is not yet rolled out to Render. Its Free filesystem is ephemeral: baseline restoration initializes a missing database and does not recover subsequent live edits. Preserve the live SQLite database before any backend deployment. This Markdown update is local only.

Migration files are applied in filename order and recorded in the `schema_migrations` table.

- `003_lead_stage_history.sql` adds an append-only stage-transition audit table. It records changes made after this migration is applied; existing leads retain their current stages and are not backfilled with invented history. Test only against a disposable database before deployment.

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
For ephemeral cloud environments (e.g., Render, Docker, or fresh developer clones), `server/db.mjs` automatically restores a full pre-seeded baseline dataset from `data/crm-baseline.sqlite.gz` (compressed 8.6 MB, expanding to 57 MB SQLite) if `data/crm.sqlite` is not present at server startup. The rows bundled in that snapshot are restored; historical row counts are snapshot-specific, and the current local product list contains 14,547 rows. Baseline restoration is initialization, not a backup of changes made after deployment.

## Latest local follow-up ? 16 October 2026

No schema migration accompanies the refresh-button exclusion, attendance revision monitor or Sales Reports diagnosis. The new attendance helper only reads current-day rows; no migration file was edited or added.

The latency integration check used an isolated SQLite snapshot. Actual local/live attendance, account mappings and billing rows were not changed.

Current local non-staged invoice coverage ends on `2026-09-08`, with 78 September invoices and none for 1?16 October. Baseline initialization and source deployment do not add missing October invoices; those must arrive through the normal Tally sync/import workflow.

Documentation and the pending feature code remain local. Preserve live SQLite data before the future backend rollout.

Release context: [source synchronization and deployment status](../../docs/superpowers/reports/2026-10-16-production-source-sync.md).

## Phase 7: report automation (004)

`004_report_automation.sql` adds schedules, unique per-period delivery occurrences and signed callback metadata. It has no business-data backfill and no default recipient/schedule. It was tested only on disposable synthetic SQLite databases. Do not start the backend against the existing database until migration/backup rollout is separately approved: `server/db.mjs` applies pending migrations at startup. Production application remains pending. See [operator runbook](../../docs/operations/PSSPL_REPORT_AUTOMATION.md).

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
