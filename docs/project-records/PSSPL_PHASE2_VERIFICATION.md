# PSSPL Phase 2 Verification — Tally Data Accuracy and RM Reconciliation

**Date:** 17 October 2026  
**Branch:** `fix/psspl-phase2-tally-accuracy` (created from `fix/psspl-phase1-security`)  
**Status:** **CONDITIONAL PASS — code-level synthetic checks passed; production accounting reconciliation remains unverified.**

## Scope and safety

Phase 2 work establishes shared invoice-source and net-voucher rules and applies them to key admin, RM, AI context, customer-detail and sales-report calculations. It fixes the RM detail endpoint's undefined period-day value. It does not modify production data, credentials, `.env`, or run migrations. Automated integration tests point `CRM_DATABASE_PATH` to a disposable directory and insert synthetic fixtures. No external Tally sync, provider call, WhatsApp message, or paid service was invoked. The original working-tree changes were retained on the Phase 2 branch; this branch was created without reset, stash, or discard.

No database schema migration was added or executed. Existing production schema compatibility should still be checked during deployment planning; the synthetic test harness adds test-only profile columns to model fields currently read by the RM report route.

## Authoritative data-source and calculation rules

- Authoritative invoice reports use persisted invoice rows only (`ingest_session_id IS NULL`) and exclude the known Excel-derived projection source (`source_sync_id <> 'excel-import'`). These historical projection rows remain stored; report queries do not delete them.
- Sales and sales-return/credit-note net amounts use invoice headers; product revenue uses invoice lines with the same voucher sign. Connector parsing currently stores magnitudes, so recognized `credit note` and `sales return` voucher types are negative in reports. This is not a general cancellation implementation.
- Monthly reporting groups eligible invoices by `invoice_date` calendar month. Financial years run 1 April through 31 March. Rupees convert to lakh by `/100,000` and crore by `/10,000,000` using shared helpers in `server/tally/metrics.mjs`.
- Explicit `tally_rm_targets.target_lakh` is converted to rupees. `salesperson_profiles.monthly_target` is not used for authoritative achievement calculations because evidence in the project shows inconsistent units. Where an explicit target is absent, achievement/shortfall is unavailable rather than estimated.
- Aggregate totals use the full matching invoice set. The RM detail invoice table remains a 50-row recent-detail window; its total and count come from complete SQL aggregates.
- New-customer count is unavailable because Tally customer records lack a reliable creation timestamp. First invoice is not treated as customer creation evidence.
- Owner attribution uses `tally_customers.owner_user_id` and CRM manager/team relationships for sales. Unassigned or unmapped customers remain unassigned; a `rm_name` alias alone does not grant or imply a CRM owner.

## RM and dealer definitions implemented

- RM/team sales: signed eligible invoice-header amounts for customers whose `owner_user_id` belongs to the RM's resolved CRM team.
- Customer/dealer revenue: complete signed eligible invoice population for that customer and requested period.
- Top-five dealer revenue and concentration: top five customer aggregates divided by the same complete RM/team actual-sales denominator. Active dealer count counts distinct assigned customer IDs with eligible invoices in the requested period.
- Dormant dealers: assigned customers with at least one eligible invoice in history and whose latest eligible invoice is more than 90 days before the report date. Customers with no invoice history are not reported as dormant dealers by this rule.
- Product revenue: signed eligible invoice-line amounts, grouped by product and requested time period.
- Data freshness continues to come from existing connector sync status. No stale synthetic workbook summary is substituted when live invoice rows are absent.

## Synthetic reconciliation and tests

The isolated fixture contains 60 assigned sales invoices at ₹100,000 each, one ₹25,000 credit note, one Excel-derived projection at ₹9,999,999, one staged invoice, and one invoice for a different team. The authorized report period reconciled to **61 eligible assigned invoices and ₹5,975,000** for the RM; company report reconciliation includes the other assigned team's ₹500,000 and reports **62 eligible invoices and ₹6,475,000**. The Excel and staged rows are excluded from those aggregates while the Excel projection remains in the fixture database. For the complete-line fixture, product line totals equal header net sales. The RM endpoint reports the complete 61-invoice count while returning at most 50 invoice details; its top-five concentration is 100% for the single eligible dealer in the fixture.

- `npm run test:phase2` — **PASS, 5/5 suites**. Covers >50 invoices, excluded Excel/staged rows, signed credit note, line/header reconciliation, financial-year and unit helpers, duplicate-key idempotence behavior, unassigned/owner-scoped reads, sales-report reconciliation, and dashboard/team/product/management/RM endpoint query compatibility.
- `npm run test:security` — **PASS, 10/10 tests**. Existing Phase 1 authorization, AI scope, backup/restore and startup protections remain passing.
- `node --test scripts/ai-provider.test.mjs scripts/attendance-live.test.mjs` — **PASS, 11/11 assertions**. Provider behavior is mocked; no real provider requests are made.
- `npx tsc --noEmit` — **PASS** after typing the RM dealer aggregate rows.
- `node --check` for modified backend modules — **PASS**.
- `git diff --check` — **PASS**; Git reports line-ending conversion warnings for existing working-tree files only.

The endpoint sweep initially exposed an existing runtime `ReferenceError` in `/admin/team/:id` (`diffDays` was read but never defined). The route now calculates an inclusive requested-period day count; the endpoint sweep passes. The first TypeScript run also exposed implicit `any` callback types for top-dealer rows; explicit row typing resolves the check.

## Phase 2 files changed

- `server/tally/metrics.mjs` — shared source eligibility, credit/return netting, FY and unit conversion helpers.
- `server/admin.mjs` — source-filtered and signed dashboard/report/RM aggregates; full dealer/product calculations; owner-ID attribution; explicit-target behavior; no fabricated new-customer count; target shortfalls unavailable when units are ambiguous; RM detail period-day fix; customer history and saved-report summary use eligible invoice data.
- `server/rm-routes.mjs` — signed eligible RM sales, product, dealer and customer-history aggregates; explicit Tally target use; unavailable achievement label where no reliable target exists; RM thrust-product source filtering.
- `server/tally/connector.mjs` — owner-scoped authoritative connector sales/customer reads and no estimated target fallback (also contains Phase 1 security work).
- `server/ai-context.mjs` — authoritative scoped product/YTD context and removal of unsupported monthly-target claims (also contains Phase 1 AI-scope work).
- `server/app.mjs` — avoids profile target fallback for sales-day actual/target data (also contains Phase 1 work).
- `src/components/admin/admin-rm-detail.tsx` — uses backend complete aggregates instead of summing the 50-row detail window; marks unsupported customer-creation metric unavailable.
- `scripts/phase2-tally-accuracy.test.mjs` and `package.json` — isolated synthetic regression suite and `test:phase2` script.

Several of these files already contained Phase 1/local changes before Phase 2. This list identifies Phase 2 edits and does not imply the full file diff originated in this phase.

## Remaining data-quality limits and risks

1. **Cancellations and adjustment semantics:** the current invoice schema/ingestion path does not expose a reliable cancellation state or a complete adjustment taxonomy. No cancellation exclusion is inferred. Accounting must specify how cancelled vouchers, debit notes, price adjustments, and reversals should be classified and paired.
2. **Live reconciliation:** no production or exported Tally snapshot was inspected, so no real ledger-to-invoice/line reconciliation, stale-sync threshold, exact source overlap, or cancellation treatment is certified.
3. **Identity and duplicates:** the synthetic suite confirms idempotent upsert for the same fixture identity. Existing source keys/company identity must be checked against Tally exports; voucher GUID uniqueness across companies and duplicate imports from different source pipelines remain unverified.
4. **Customer/dealer mapping:** missing/duplicate customer identities, unassigned owners and historical ownership changes require a reviewed mapping. No `rm_name` alias is promoted to an owner automatically. Alias-only historical attribution stays unassigned until reconciled.
5. **Targets:** explicit RM target rows are used where present. Salesperson targets and historical report-card targets still need a documented unit and ownership convention before trustworthy achievement percentages can be published.
6. **Historical projections:** workbook-derived tables remain in storage for historical traceability. Some legacy historical presentation fields and catalog snapshot fields still exist; they must not be interpreted as current authoritative Tally sales without a separate reviewed migration/reconciliation plan.
7. **Source exclusion:** the known Excel projection discriminator is the exact source key `excel-import`. Other potential duplicate/non-authoritative source keys are not known from live data and need inventory before deployment.
8. **Freshness and external source errors:** route code no longer substitutes stale workbook totals, but no simulated connector outage/stale-run endpoint test has yet established user-facing freshness labels on every report surface.

## Migration, deployment and acceptance

No migration is required by the code changes made here, and no migration was executed. Deployment still needs a reviewed canonical source/customer/target mapping, accounting decisions for cancellation and adjustment voucher types, a live Tally reconciliation snapshot, and a stale-data threshold/visibility rule. Keep Phase 1 security changes intact and run the suite against a disposable copy of the release schema before rollout. Do not use production database writes for that verification.

**Acceptance: CONDITIONAL PASS.** Code-level synthetic reconciliation, authorization regressions, endpoint compatibility, provider/attendance tests, TypeScript, and syntax checks pass. Production accounting correctness remains unverified because no production-like Tally extract and no authoritative cancellation, duplicate-company identity, historical RM mapping, or salesperson-target unit rules are available. Phase 3 has not started. Recommendation: Phase 2 code review can proceed; do not treat this as production deployment approval or begin Phase 3 until the listed data/business decisions and live reconciliation are reviewed.

## Later-phase status reference - 17 October 2026

This document preserves the verification results and decisions recorded for this phase. Phases 5, 6 and 7 now have their own local verification reports; earlier statements that a later phase had not started describe the time of that review. See [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md) for current implementation, regression results and remaining conditions. Overall local Phase 7 acceptance is CONDITIONAL PASS. Production readiness and final UAT remain pending; final UAT requires user approval.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
