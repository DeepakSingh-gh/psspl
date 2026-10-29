# PSSPL Phase 6 Verification

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

**Scope:** Lead pipeline, filtered Tally sales reporting, and aggregate exports.  
**Branch:** `feature/psspl-phase3-rm-report-cards`  
**Status:** **CONDITIONAL PASS** — implemented scope passes isolated regression checks; several broader report and business-rule requirements remain open.

## Implemented

- Preserved the eight existing pipeline stages and aligned displayed labels with the required names.
- Added strict lead name, expected-value, and next-action date validation.
- Added team-scoped visibility: salespeople see their own leads; RMs see their own and direct reports; admins can view company leads.
- Added assignment controls for admins and RMs, limited to active authorized RM/salesperson users. Salespeople cannot assign leads.
- Added transactional stage history with actor, timestamp, previous stage, and new stage. No history is fabricated for existing leads.
- Added role-scoped conversion counts and a Won of decided leads summary. Zero decided leads display as unavailable.
- Added Admin Sales Reports filters for date range, financial year, customer, product, RM/salesperson (RM includes direct reports), territory, and dealer type. Filter predicates apply to all invoice-based aggregates.
- Removed the 100-row cap on customer/product report aggregates. CSV/Excel exports use all aggregate rows returned, apply the current filters, and identify authoritative Tally source, period, and total. CSV formula-like values are escaped.
- Saved report summaries now recalculate from backend filters and retain filter context.
- Tally invoice source filtering continues to exclude synthetic Excel projections and use Phase 2 net invoice rules.
- Fixed the My Day HTTP 500 caused by an unimported `netInvoiceLineAmount` reference in `server/tally/connector.mjs`; added an isolated authenticated route smoke test.

## Files changed

- `database/migrations/003_lead_stage_history.sql` — additive history table and index.
- `database/migrations/README.md` — migration behavior and no-backfill note.
- `server/sales-routes.mjs` — lead scope, validation, assignment, stage history, detail, and conversion API.
- `server/admin.mjs` — filtered report aggregates and filter-aware saved reports.
- `server/tally/connector.mjs` — import the invoice-line calculation used by My Day product summaries.
- `src/lib/api.ts` — lead/report filter and assignment API calls.
- `src/components/sales/lead-board.tsx` — labels, assignment selector, conversion/history display, stage error recovery.
- `src/components/admin/admin-reports.tsx` — report filters and labeled complete CSV/Excel exports.
- `scripts/phase6-leads.test.mjs`, `scripts/phase6-reports.test.mjs`, `scripts/phase6-my-day.test.mjs`, `package.json` — isolated tests and `test:phase6` command.
- `PSSPL_REQUIREMENTS_AUDIT.md`, `PSSPL_REQUIREMENTS_AUDIT_MATRIX.md`, `PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md` — evidence-supported audit updates.

## Verification

- Phase 6 synthetic SQLite/API tests: **4 passed**. Coverage includes validation, stage changes/history, manager/other-team access, assignment denial, conversion, FY and report filters, 105 customer aggregates, export-facing reconciliation, saved filters, and admin-only report access.
- Isolated end-to-end My Day smoke test: **passed (HTTP 200)** with synthetic data after the runtime import fix.
- Phase 1 security: **10 passed**.
- Phase 2 Tally accuracy: **6 passed**.
- Phase 3 RM intelligence: **4 passed**.
- Phase 4 management: **8 passed**.
- Phase 5 field workflows: **5 passed**.
- AI provider and attendance regression: **11 passed**; provider calls were mocked.
- `npx tsc --noEmit`: passed after correcting a missing lead owner type in the new assignment selector.
- `node --check` for changed server/migration/test modules: passed.
- `git diff --check`: passed (only existing LF/CRLF conversion warnings appeared).
- All automated SQLite/API tests used disposable synthetic databases. No migration command was run. The pre-existing Node watch process restarted after server files changed and automatically applied migration `003_lead_stage_history.sql` to the `.env`-configured local CRM database. A read-only metadata check confirmed the migration/table; its additive DDL created only an empty table and index, with no business-row changes or backfill. No credentials, paid provider, Tally sync, WhatsApp, deployment, or Git operation was invoked.

## Remaining limitations and decisions

- Migration 003 is present in the configured local database because startup applies migrations automatically. Before any production rollout, take the approved backup and review migration state; stage history begins at migration application, and prior transitions cannot be reconstructed.
- Filters are on Admin Sales Reports. They are not yet consistent across every legacy dashboard, management report, or RM report-card view. Targets and field activity remain in their existing separate report flows.
- Print/Save PDF still prints the current paginated screen; complete unpaginated export is available through CSV/Excel only. Excel remains the existing HTML `.xls` format.
- Lead scheduling continues to use `next_action_date`, without a linked follow-up reminder row. Won/Lost closure date/reason and assignment audit history are not represented.
- Business transition policy for reopening Won/Lost leads is unspecified. The API validates the stage enum and records every changed stage but does not impose an unapproved transition graph.
- Browser/device acceptance, production migration readiness, and live deployment behavior remain unverified.

**Recommendation:** Continue review and approve remaining reporting/filter and lead lifecycle decisions before treating Phase 6 as fully accepted. Code-level work is locally testable; production deployment is blocked on controlled migration/backup review and browser acceptance. All work remains local and uncommitted.

## Later-phase status reference - 17 October 2026

This document preserves the verification results and decisions recorded for this phase. Phases 5, 6 and 7 now have their own local verification reports; earlier statements that a later phase had not started describe the time of that review. See [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md) for current implementation, regression results and remaining conditions. Overall local Phase 7 acceptance is CONDITIONAL PASS. Production readiness and final UAT remain pending; final UAT requires user approval.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
