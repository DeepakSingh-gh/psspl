# Pipeline synchronization design

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Implement the user's requested automatic cross-session updates with authenticated SSE over the existing Express API. No UI redesign, dependencies, broker or change to pipeline rules.

The current lead mutations commit correctly but the dashboard loaders run only at mount/manual refresh. There is no existing WebSocket/SSE service. Browser polling would add repeated requests; WebSockets add unnecessary bidirectional infrastructure. SSE carries invalidation revisions; targeted REST reads retain SQLite as the source of truth.

SQLite triggers maintain small per-owner revision counters in the same transaction as lead inserts, edits, assignments and deletions. Rollback also rolls back revisions. Profile changes invalidate names/team membership. The stream checks committed revisions at 500 ms intervals and emits only scoped revision hashes, never lead records. Existing user/team authorization is rechecked while connected. This installation has a single CRM database and no tenant/company key on users/leads; do not treat the lead's free-text company name as tenant authorization. Separate company databases require separate streams. Future writers to the same lead table automatically participate through the triggers.

One shared fetch-based SSE subscription per browser tab uses existing bearer/cookie authentication without URL tokens. It reconnects with backoff, resynchronizes after reconnect/focus/online and falls back to low-frequency targeted reads if streaming fails. Coalesced sequential refetches avoid duplicate/out-of-order state. Keep existing content during background refresh and preserve filters, tabs, expanded cards and scroll.

Admin overview refetches only pipeline summary/recent leads, not financial/dashboard data. RM summaries and shared LeadBoard subscribe to the same signal. Reassignments invalidate both the previous and next owner's scope. Actual values/counts are calculated from committed rows, never event deltas.

Verification uses disposable databases only: commits/rollback, create/edit/delete/reassignment, permissions and revocation, simultaneous updates, SSE reconnect, separate browser contexts and exact stage totals/values with stable UI state. No real business rows are created or mutated for tests. No deploy/commit is requested.
