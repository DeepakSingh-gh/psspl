# PSSPL Phase 3 Verification — RM Performance Report Cards and Dealer Intelligence

**Date:** 17 October 2026  
**Branch:** `feature/psspl-phase3-rm-report-cards` (created from `fix/psspl-phase2-tally-accuracy`)  
**Acceptance:** **CONDITIONAL PASS — implementation and synthetic regression checks pass; live production mapping, target configuration, and Tally reconciliation remain unverified.**

## Scope and safety

Phase 3 consolidates RM report-card calculations and management findings around authoritative Phase 2 invoice aggregates. It adds auditable dealer status and trend data, target-period comparisons, and consistent management insights on the report card and PDF. Changes preserve the React/Express/SQLite architecture and existing endpoints. No production data, credentials, `.env`, or database schema was modified; no production migration, deployment, merge, Tally synchronization, WhatsApp send, or paid AI request was run. Endpoint tests use the existing Phase 2 isolated SQLite harness and synthetic fixtures.

Before branch creation the working tree contained uncommitted Phase 1, Phase 2 and other project changes. The new branch was created from the requested Phase 2 branch without reset, stash, or discard. These files remain present in the working tree; the file list below describes Phase 3 additions, not the origin of all existing diffs.

## Implementation and calculation behavior

- `server/admin.mjs` resolves an RM through an exact unique CRM user mapping and builds the authorized owner/team scope from CRM user IDs. An alias or Tally display name alone is not treated as an owner. Ambiguous or absent mapping yields an explicit unavailable state instead of fabricated team sales.
- Report-card MTD and FYTD actuals use the eligible signed Tally invoice population and explicit `tally_rm_targets.target_lakh` values converted to rupees. A target is not inferred from a salesperson profile field with inconsistent units. Arbitrary date ranges without a matching target report achievement as unavailable.
- The monthly target chart aggregates complete eligible invoice data for the RM's owned customer set, includes zero-sales months, and leaves absent target values unavailable. Endpoint KPIs and the report-card/PDF consume the same server-side metrics.
- Dealer/customer revenue, active-dealer counts, and top-five concentration use complete eligible invoice aggregates, not the recent 50-row invoice detail window. The displayed invoice detail list remains capped at 50 for response size; its aggregate count and totals are not capped.
- Dealer intelligence distinguishes (1) no sales in the selected period, (2) dormant with adequate dated invoice history, (3) declining versus a comparable preceding period, and (4) insufficient history. Dormancy uses a validated configurable threshold; default fallback values are visibly marked provisional. A dealer with no reliable latest invoice or no historical evidence is not labelled dormant.
- Product comparison uses current and preceding comparable periods, retaining prior-period-only products so decline-to-zero is visible. Product sales continue to use the Phase 2 signed eligible invoice-line definition.
- Rule-based management insights are generated from supported backend metrics and include evidence period, metric, and suggested action. The screen, manager action tab, and PDF use those same insights rather than recalculating from a capped invoice list or visit proxies. Insights remain recommendations; the app does not persist an assigned action owner, due date, or closure state.
- New-customer count remains unavailable because the inspected Tally customer schema has no reliable creation date. No invoice date or estimated percentage is presented as customer creation evidence.

## Files changed for Phase 3

- `server/rm-report-intelligence.mjs` — validated threshold configuration, dealer period/dormancy/decline classification, and deterministic evidence-backed management insights.
- `server/admin.mjs` — exact RM mapping and owner scope, period-targeted monthly/YTD metrics, complete invoice-history and dealer aggregates, comparative product rows, scoped activity metrics, and shared insights in the RM detail response.
- `src/components/admin/admin-rm-detail.tsx` — unavailable states for unsupported targets, MTD/FYTD metrics, authoritative dealer states, backend insights and links to supporting customer/product records.
- `src/components/admin/rm-report-pdf.tsx` — report metrics, top dealers, and actions now use the same backend aggregates and insights as the report-card screen.
- `scripts/phase3-rm-report.test.mjs` — synthetic dealer-state, threshold, concentration, target, and missing-mapping regression cases.
- `scripts/phase2-tally-accuracy.test.mjs` — expanded synthetic RM endpoint regression coverage for explicit targets, overdue follow-ups, zero-sales RM, and team scoping.
- `package.json` — `test:phase3` command.

These files also contain prior Phase 1/Phase 2 or pre-existing work; the list identifies the Phase 3 code paths touched and does not claim those complete-file diffs originated in this phase.

## Verification results

- `npm run test:security` — **PASS, 10/10**. Covers authorization regressions, AI scope, encrypted backup/restore, startup guard, and rate limiting.
- `node --test scripts/ai-provider.test.mjs scripts/attendance-live.test.mjs` — **PASS, 11/11**. Provider requests are mocked; no paid/external provider call was made.
- `npm run test:phase2` — **PASS, 5/5**. Includes 61 eligible invoices, complete aggregate with a 50-row detail window, explicit target conversion, RM dashboard/team isolation, and endpoint compatibility.
- `npm run test:phase3` — **PASS, 4/4**. Confirms dormant/no-period-sales/declining/insufficient-history distinctions; synthetic 19% achievement and 96% concentration evidence; no inferred underperformance when target or ownership is missing; and provisional status for missing or invalid threshold configuration.
- `npx tsc --noEmit` — **PASS**.
- `node --check server/admin.mjs` and `node --check server/rm-report-intelligence.mjs` — **PASS**.
- `git diff --check` — **PASS**. Git emitted line-ending conversion notices for existing working-tree files; no whitespace errors were reported.

The synthetic endpoint fixture verifies the RM report's full-period total is ₹5,975 across 61 invoices, while `actualSales` remains a maximum 50-row detail collection; the dealer aggregate reconciles to the endpoint actual. Its configured explicit target also yields ₹5,975 and 100% achievement. A second zero-sales RM without a target has null achievement and no unsupported underperformance alert. Test-only RM and cross-team records verify team scope.

## Remaining data-quality and operational limits

1. No production-like Tally export or live database was read. Real ledger reconciliation, customer identity completeness, invoice source overlap, historical RM ownership, and true production report parity remain unverified.
2. RM alias resolution may still fail or be ambiguous against the live roster. The endpoint now surfaces unavailable mapping instead of inventing attribution; a canonical roster and reviewed customer-owner mapping are required to obtain complete RM totals.
3. Production target rows and their period convention were not inspected. Achievement is available only where an explicit matching target exists. Configure/report owners must confirm target cadence and coverage before treating MTD/YTD achievement as operationally complete.
4. Dormancy, target-alert, concentration, and visit-completion thresholds are configurable through `RM_DORMANT_INACTIVITY_DAYS`, `RM_TARGET_ALERT_PERCENT`, `RM_DEALER_CONCENTRATION_ALERT_PERCENT`, and `RM_VISIT_COMPLETION_ALERT_PERCENT`. Missing or invalid configuration uses provisional defaults and the report marks that status. Management must approve production thresholds and provide deployment configuration.
5. Customer creation dates are unavailable, so the six-month new-customer metric remains unavailable. A reliable source field and historical coverage are required before implementation can calculate it.
6. The tests verify deterministic insight generation and endpoint scope, not business approval of each threshold or recommendation. Recommendations are not persisted as assigned/closed work items.
7. PDF behavior is type-checked and shares the response data model, but no browser/print rendering or visual regression run was performed in this environment.

## Migration and deployment readiness

No schema change or migration is required by the Phase 3 code, and none was executed. Code-level readiness is **PASS** for the exercised synthetic cases. Production deployment readiness is **NOT ESTABLISHED** until canonical RM/customer mapping, target cadence and rows, insight thresholds, and production-like Tally reconciliation are reviewed. Preserve Phase 1 authorization protections and verify release-schema compatibility using a disposable database before rollout.

**Phase 3 acceptance: CONDITIONAL PASS.** Recommendation: proceed to code review and business validation of thresholds/mappings. Do not treat this result as production approval. Phase 4 has not started.

## Later-phase status reference - 17 October 2026

This document preserves the verification results and decisions recorded for this phase. Phases 5, 6 and 7 now have their own local verification reports; earlier statements that a later phase had not started describe the time of that review. See [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md) for current implementation, regression results and remaining conditions. Overall local Phase 7 acceptance is CONDITIONAL PASS. Production readiness and final UAT remain pending; final UAT requires user approval.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
