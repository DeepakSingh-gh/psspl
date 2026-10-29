# Database migrations

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

## Email provider and account notices (013/014)

- `013_email_queue_provider.sql` adds the queued provider, defaulting pre-existing jobs to Resend. Switching to SMTP does not reroute old Resend jobs.
- `014_account_email_notices.sql` expands queue/delivery purpose constraints with `account`. It transactionally rebuilds the two tables, copies all existing records and recreates indexes. Populated-record preservation and foreign-key checks passed on a disposable database.
- Account notices without a usable CRM URL do not create/reset tokens. Their encrypted payload may include an explicitly supplied, verified initial password and all employee details; no password column is added to user/profile tables. Full setup/reset links keep the existing token schema and expiry.
- The professional email template and credential-version metadata use encrypted payload fields and introduce no further SQL migration.
- Preserve both the SQLite backup and `CRM_EMAIL_QUEUE_KEY`. Review pending jobs before starting/restarting an enabled worker. Back up and approve the target production migration separately; local schema state does not prove production rollout.

## Account deletion (012)

`012_user_account_deletion.sql` adds nullable `users.deleted_at`. Deletion removes sign-in credentials and hides the account from Users & access while retaining the referenced user/profile identity for CRM history. Existing rows are unchanged until an admin explicitly confirms deletion. Reporting employees must be reassigned before deleting their RM. Historical names and employee codes remain attached to prior activity; a replacement account receives its own employee code. No production migration was run during implementation.

## 20 October 2026: Login ID (011)

`011_user_login_id.sql` adds nullable `users.login_id` and a case-insensitive unique index. Existing password hashes, roles, active flags, RM assignments, CRM records and pending invitations remain unchanged. Existing accounts continue signing in with email. New account creation requires a Login ID and initial password and creates an active account without an activation requirement. The save-only action sends nothing; a separate, explicit create-and-email selection sends account details through the existing queue.

Fresh-schema, upgrade-preservation and repeat-application checks passed on disposable databases. No production migration was run. Follow the established backup and startup-migration approval process when deploying. See the [authentication workflow report](../../docs/superpowers/reports/2026-10-20-authentication-workflow.md).

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

## Historical local follow-up ? 16 October 2026

No schema migration accompanies the refresh-button exclusion, attendance revision monitor or Sales Reports diagnosis. The new attendance helper only reads current-day rows; no migration file was edited or added.

The latency integration check used an isolated SQLite snapshot. Actual local/live attendance, account mappings and billing rows were not changed.

Current local non-staged invoice coverage ends on `2026-09-08`, with 78 September invoices and none for 1?16 October. Baseline initialization and source deployment do not add missing October invoices; those must arrive through the normal Tally sync/import workflow.

Documentation and the pending feature code remain local. Preserve live SQLite data before the future backend rollout.

Release context: [source synchronization and deployment status](../../docs/superpowers/reports/2026-10-16-production-source-sync.md).

## Phase 7: report automation (004)

`004_report_automation.sql` adds schedules, unique per-period delivery occurrences and signed callback metadata. It has no business-data backfill and no default recipient/schedule. It was tested only on disposable synthetic SQLite databases. Do not start the backend against the existing database until migration/backup rollout is separately approved: `server/db.mjs` applies pending migrations at startup. Production application remains pending. See [operator runbook](../../docs/operations/PSSPL_REPORT_AUTOMATION.md).


## Account migrations - 20/21 October 2026

- `011_user_login_id.sql`: nullable Login ID with case-insensitive uniqueness. Existing account passwords, activation state and invitations are preserved.
- `012_user_account_deletion.sql`: nullable `users.deleted_at` for removal of sign-in access while preserving CRM attribution. Archived Employees reads this existing schema.
- `013_email_queue_provider.sql`: preserve provider identity for queued messages.
- `014_account_email_notices.sql`: preserve queued/delivery rows while adding token-free account notices.
- `015_report_query_indexes.sql`: add covering invoice and invoice-line indexes for admin sales aggregates. Applied locally; Product Trends responses matched both financial-year baselines and financial regression checks passed.
- `016_visit_leads.sql`: add exact customer and original visit links for leads created when an RM completes a visit. Existing manually entered leads are left unlinked; no name-based backfill runs.
- Production application is not established by local source changes. Back up the target database and review migration rollout before starting the updated API. The separately authorized local employee-removal operation is recorded in the current source summary.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../docs/operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
