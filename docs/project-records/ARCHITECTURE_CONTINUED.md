# PSSPL CRM Architecture — continued

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Continuation of [ARCHITECTURE.md](../../ARCHITECTURE.md).

### 6. High-Performance Data & Caching Architecture
* **Composite SQLite Indexes:**
  - `idx_tally_customers_rm_name`: Accelerates RM customer lookups and outstanding joins.
  - `idx_tally_invoices_session_date`: Optimizes date-range invoice filtering while ignoring raw ingestion sessions.
  - `idx_tally_invoice_lines_inv_prod`: Eliminates full scans on product-line item lookups across 27,000+ line items.
  - `idx_tally_rm_product_sales_rm`: Speeds up previous-year RM performance comparisons.
  - `idx_tally_payments_date_customer`: Accelerates payment receipt reconciliation by date and customer ID.
  - `idx_tally_purchases_date_supplier`: Indexes supplier procurement vouchers by purchase date and supplier name.
  - `idx_tally_purchase_lines_product`: Optimizes raw material volume aggregation across purchase line items.
  - `idx_tally_customers_owner_user_id`: Enforces instant owner-based customer scoping for sales reps.
* **Single-Pass In-Memory Thrust Aggregation (`calculateAllThrustProductsBatch`):**
  - Replaced 330+ repetitive nested SQL queries with an in-memory aggregation map, cutting `/api/admin/team` latency from 3,630ms to ~450ms (8× speedup).
* **Client-Side SWR (Stale-While-Revalidate) Cache Layer (`src/lib/use-admin-data.ts`):**
  - Client hook provides instant zero-latency rendering of cached records with background API revalidation.
  - Namespaced composite cache keys (`${loaderSource}::${JSON.stringify(deps)}`) prevent cross-endpoint data pollution.
  - Defensive null-safe accessors in `AdminOverview` ensure resilient runtime behavior during state transitions.
* **Webpack Runtime & Build Cache Isolation:**
  - When transitioning between production verification (`npm run build`) and active development (`npm run dev`), `.next` build caches are automatically isolated/purged to prevent in-memory chunk map collisions (such as `Cannot find module './308.js'`).

## Latest local follow-up ? 16 October 2026

**Data freshness paths (21 October):** Manual Refresh Data dispatches `psspl:refresh-data` to registered loaders and calls `router.refresh()`, preserving local state. Attendance revision monitoring separately invalidates subscribed admin cache keys. `GET /api/admin/attendance/revision` remains admin-only and no-store.

**Monitor behavior:** One shared poll checks every 2,000 ms while visible, never overlaps revision requests, aborts after 10,000 ms or final unsubscribe, and checks on focus/online/visibility recovery. Unchanged revisions do not refetch whole dashboards. These changes require a future coordinated frontend/backend release.

**UI scope:** The root-mounted refresh component hides itself on `/login` and `/`; it remains available on data routes and is hidden in printed output.

**Reporting boundary:** `/api/admin/reports/sales` honors the selected date range and excludes staged invoices. Read-only local coverage ends on `2026-09-08`; September has 78 invoices and 1?16 October has none. Attendance updates do not synchronize Tally billing data. Existing date filtering was retained.

Release context: [source synchronization and deployment status](../superpowers/reports/2026-10-16-production-source-sync.md).

## Current local status - Phase 7, 17 October 2026

Phase 7 is a **CONDITIONAL PASS** for local implementation: authorized AI evidence selection, approved daily/monthly report scheduling, durable delivery/retry/callback handling, scoped in-app reminders and task-oriented training SOPs. Verification passed 68 automated tests plus the separate My Day smoke check, TypeScript, 29 syntax checks and whitespace validation.

All work remains local and uncommitted on `feature/psspl-phase3-rm-report-cards`. No deployment, existing-database migration, real WhatsApp message or paid provider request was performed. Delivery is disabled by default. Recipients/opt-in/templates/schedules, reviewed provider configuration, backup/migration rollout, data freshness/mapping decisions, browser acceptance and training sign-off remain outstanding. Final UAT has not started and awaits user approval.

- [Phase 7 verification and changed files](./PSSPL_PHASE7_VERIFICATION.md)
- [Report automation operator runbook](../operations/PSSPL_REPORT_AUTOMATION.md)
- [RM/SE SOP](../training/PSSPL_RM_SE_SOP.md)
- [RM/Manager SOP](../training/PSSPL_RM_Manager_SOP.md)
- [Admin SOP](../training/PSSPL_Admin_SOP.md)

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
