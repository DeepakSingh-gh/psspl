# Automatic pipeline synchronization - 20 November 2026

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Implemented locally following the user's real-time pipeline specification. No commit, push or production deployment was performed.

## Cause and implementation

Lead updates already saved correctly through `/api/sales/leads/:id/stage`, but other sessions loaded their data only on mount or manual refresh. There was no existing WebSocket/SSE transport.

- Added authenticated `/api/pipeline/events` SSE invalidations and `/api/pipeline/summary` for selective pipeline reads. No dependencies or external services were added.
- SQLite migrations 017/018 maintain per-owner revision counters transactionally on lead creation, edits, stage changes, assignments, deletion and relevant profile/account changes. Rolled-back writes do not advance committed revisions. Visit-generated leads and future writers to the same table participate automatically.
- The API uses one scheduler per worker while clients are connected, checking committed revisions every 500 ms. Revisions are shared for the same user within a tick. Delivery contains only scoped hashes, with heartbeat and backpressure handling; it rechecks session validity and permissions and ends revoked/expired sessions.
- Admin overview updates stage counts, expected values, total count, recent lead/customer table and assignment names through the small pipeline endpoint. It does not reload the financial overview, alerts or management dashboards for a lead event.
- RM home preserves its existing active-salesperson team scope. Shared RM/salesperson LeadBoard views preserve their existing REST team visibility. Both use the same live signal. The RM team financial page has no displayed pipeline widget and makes no unnecessary subscription.
- One authenticated fetch-based stream is shared by subscribed components in a tab. Bearer credentials remain in headers; cookie mode remains supported. No auth token enters an event URL. Reconnect/focus/online restores latest data, duplicate revisions coalesce, and transient targeted-read failures retry without waiting for another change. A low-frequency targeted-read fallback remains available when streaming fails.
- Background updates retain existing content and state. Stage changes display saved data after successful mutation; failed changes do not leave an invented stage visible. A small opacity transition honors reduced-motion preferences without changing colors or layout.

## Authorization and deployment boundary

This installation has one CRM SQLite database and no tenant/company ID on users or leads. Delivery follows the existing admin/self/explicit-team boundary. A lead's free-text company name is not treated as tenant authorization. Separate company deployments/databases must retain separate authenticated API/database boundaries; this change does not introduce a multi-tenant schema.

The SSE watcher observes the shared SQLite database rather than an in-memory mutation counter, so writers and API workers using that database participate. Separate unsynchronized SQLite copies on different hosts are not a shared source of truth. Production streaming/proxy behavior was not remotely tested. The response sets `no-transform` and `X-Accel-Buffering: no`; blocked/dropped streams reconnect and have a targeted-read fallback.

The local development API applied 017 while watching source. Profile insertion/deletion coverage was added in a separate 018 upgrade and applied with `npm run db:migrate`. Before that upgrade, an online SQLite backup was retained at `data/crm-before-pipeline-profile-triggers-2026-11-20.sqlite`. These migrations add synchronization metadata/triggers and do not rewrite business rows. Production retains its existing schema-change approval configuration.

This is CRM pipeline synchronization. It does not change Tally's hourly ingestion schedule, clean Supabase, or alter existing pipeline stages/financial rules.

## Verification

The final combined run passed **18 tests, zero failures, zero skips**:

```powershell
$env:CRM_PIPELINE_BROWSER_TEST='1'
node --test scripts/pipeline-sync.test.mjs scripts/pipeline-monitor.test.mjs scripts/visit-lead-pipeline.test.mjs scripts/phase6-leads.test.mjs scripts/attendance-live.test.mjs
```

Coverage includes committed versus rolled-back changes, unauthorized writes, RM and authorized salesperson stage changes, old/new assignment scopes, exact totals/expected values, profile removal, inactive-report dashboard scope, concurrent writes, current revision on reconnect, revoked-session stream closure, shared connection lifecycle, late subscribers, split SSE frames, fallback/reconnect, retry after failed reads and serialized/coalesced reads.

The browser test launched two independent Chromium browser processes with different authenticated sessions. Their HTTP requests were forwarded to a real isolated SQLite-backed API; API responses were not mocked. It verified:

1. RM moves the opportunity from Sample to Quotation using the existing UI.
2. Admin automatically changes Sample from 1 to 0 and Quotation from 0 to 1, with INR 12,500 and the matching table stage.
3. No document navigation or full `/api/admin/overview` request occurs for that pipeline change.
4. The selected financial-year control and scroll position remain unchanged.
5. An offline Admin session receives the latest saved stage after reconnection, retaining exactly one lead row.
6. An Admin-origin stage change appears in the RM board, with the Leads tab retained.
7. The existing pipeline viewport remains available at 390 px mobile width, with no browser page errors.

All test records lived in disposable temporary databases. The existing visit/pipeline regression fixture was made date-stable: its generated `created_at` values now match its fixed October reporting window rather than the current machine date. No production report logic was changed for that fixture correction.

TypeScript (`tsc --noEmit --incremental false`) and the production build passed. The first build hit the existing OneDrive `EINVAL/readlink` issue in generated `.next-runtime`; only that verified workspace cache directory was moved aside, then a fresh build passed. Existing CSS Autoprefixer warnings remain nonblocking. No user database directory was moved or deleted.

Evidence: [combined tests](tests.log), [migration regression](migration-regression.log), [TypeScript](typescript.log), [successful build](build-final.log). Browser screenshot is retained locally at ignored `scratch/pipeline-sync-admin.png`.

## Review

Independent review prompted corrections for RM dashboard scope, unused subscriptions, transient read retries, late subscribers and a superseded-read race. The fixes preserve existing business scopes and keep failed/superseded background reads eligible for retry. Existing unrelated responsive/documentation changes were retained.
