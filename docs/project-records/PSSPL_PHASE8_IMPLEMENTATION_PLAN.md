# PSSPL Phase 8 Final UAT Implementation Plan

Date: 18 October 2026 (Asia/Kolkata)
Branch: `feature/psspl-phase3-rm-report-cards`
Status: EXECUTED. Local Phase 8 verification and deliverables are complete. Final UAT acceptance: FAIL; see [final report](./PSSPL_FINAL_UAT_REPORT.md) and [client checklist](./PSSPL_CLIENT_APPROVAL_CHECKLIST.md).

The preparation observations and intermediate counts below are retained as execution-plan history. Current reconciled counts, test results, defects and concurrent database activity are in the final report and docs/uat/phase8/preservation.json.

## Preparation assessment retained for traceability

At preparation time, Phase 8 had not been completed. [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md) explicitly states that final UAT has not started. Neither `PSSPL_FINAL_UAT_REPORT.md` nor `PSSPL_CLIENT_APPROVAL_CHECKLIST.md` exists at preparation time. Phase 1 through Phase 7 reports and isolated regression suites provide a foundation, but do not establish final workflow, browser, device, provider, or client acceptance.

This phase is verification and requirements reconciliation. Additional feature development is outside its scope. Record discovered gaps and deployment blockers rather than silently expanding implementation scope.

Preparation reviewed the supplied Phase 8 request, repository status, phase reports, audit documents, test entrypoints, database startup and backup implementation. No tests or application startup were executed during the preparation assessment. Subsequent Phase 8 execution is recorded in the final report. Existing application and audit files were preserved.

## Requirements accounting discrepancy

Both matrix files must be reconciled: [matrix A through D](./PSSPL_REQUIREMENTS_AUDIT_MATRIX.md) and [matrix E onward](./PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md). Together they contain exactly 142 rows with 142 unique requirement IDs.

| Status | Current matrix labels | Original audit summary |
| --- | ---: | ---: |
| COMPLETED | 46 | 21 |
| PARTIALLY COMPLETED | 85 | 92 |
| NOT IMPLEMENTED | 4 | 13 |
| BROKEN | 2 | 11 |
| NOT VERIFIED | 5 | 5 |
| Total | 142 | 142 |

The matrix labels imply 46 / 142 = 32.39%; the audit summary retains 21 / 142 = 14.79%. Neither is a final Phase 8 verified completion percentage. Some rows retain older findings despite later phase evidence; others marked completed still need acceptance appropriate to their requirement. Re-evaluate every row before publishing a new percentage.

## Execution order and safety

1. Capture branch, revision, working-tree status and hashes of existing application, database and configuration files without printing secrets. The inspected revision is `87eae1ec68bccb8b11e2950bafecc8ccc81da508`; local modifications are substantial and are part of the assessment target.
2. Check for active watch processes before editing anything that could restart the application. Phase 6 documents an earlier watch restart applying a migration automatically.
3. Use fresh temporary directories and synthetic databases. Set `CRM_DATABASE_PATH` explicitly, `CRM_DISABLE_BASELINE_RESTORE=true`, and `NODE_ENV=test` before any database-dependent import. Never copy the bundled client baseline into UAT fixtures.
4. Inspect each test and startup dependency before execution. Clear inherited provider credentials in the child process, disable delivery and external sync, mock AI/STT/WhatsApp transports, and reject unexpected outbound requests. Setting `NODE_ENV=test` alone is not proof that external actions are disabled.
5. Use loopback ports for isolated API/browser testing. Do not run `npm run dev`, normal backend startup, migrations, seeds, imports or backup commands with their default database paths. `server/db.mjs` executes migrations and schema setup on import.
6. Keep all changes local and uncommitted on the existing branch. No branch creation, commit, push, merge, rebase, reset, stash, deployment, production credential changes, live Tally access, real WhatsApp messages or paid provider calls.

## Work packages

### 1. Reconcile all requirements

For each original ID record requirement wording, source trace, current status, executed check, observed result, evidence link, remaining gap and approval dependency. Preserve all 142 IDs without duplicates or invented requirements. Retain provenance limits: the original audit says separate September 1, 8 and 26 meeting records were not available. Do not infer meeting-specific acceptance from technical tests.

Classify as COMPLETED, PARTIALLY COMPLETED, NOT IMPLEMENTED, BROKEN or NOT VERIFIED. Code presence and unit success cannot substitute for browser/device/provider/real-data evidence where that is required. Distinguish a missing capability from an implemented capability awaiting execution. Treat documented historical defects as candidates for rechecking rather than current confirmed failures.

Update both matrices, the audit summary and evidence register together. Recalculate `COMPLETED / 142 * 100`, and verify all five counts sum to 142.

### 2. Run isolated regression and workflow verification

Existing suites to reuse after the isolation review:

- `scripts/phase1-security.test.mjs`
- `scripts/phase2-tally-accuracy.test.mjs`
- `scripts/phase3-rm-report.test.mjs`
- `scripts/phase4-management.test.mjs`
- `scripts/phase5-field-workflows.test.mjs`
- `scripts/phase6-leads.test.mjs`, `scripts/phase6-reports.test.mjs`
- `scripts/phase6-my-day.test.mjs` (imports the full application; review startup side effects separately)
- `scripts/phase7-automation.test.mjs`
- `scripts/ai-provider.test.mjs`, `scripts/attendance-live.test.mjs`

Run the Node test suites in isolated processes with captured commands, results and fixture details; run the standalone My Day script separately. Add narrowly focused Phase 8 integration checks only for uncovered cross-module workflows. Run the locally installed TypeScript compiler and relevant syntax checks. Historical passing counts are not fresh test results.

| Role | Workflow to execute | Denied operations to execute |
| --- | --- | --- |
| Admin | Actual login/logout, KPIs, RM ranking, attention alerts, report-card drill-down, report filters, CSV/Excel/PDF output, Ask AI, WhatsApp configuration APIs | Unauthenticated access and expired sessions |
| RM or manager | Login, own/team visibility, customers, report cards, dealer intelligence, activity and follow-ups | Other-team customers, records, reports and unauthorized reassignment |
| Salesperson | Login, check-in/out, visits, calls, audio/transcription with mocks, leads, follow-ups and daily summary | Peer or other-team records, admin routes, protected audio and assignment |

Existing tests often create sessions directly; separately exercise the real login flow with synthetic password hashes. Verify persistence and resulting summaries across steps, rather than only successful endpoint responses. Compare downloaded exports with fixture totals and active filters.

### 3. Reconcile synthetic Tally data

Cover authoritative invoice provenance; exclusion of synthetic workbook projections; sales and return signs; cancellation/duplicate limitations; MTD/FYTD and fiscal boundaries; RM attribution and ambiguous mappings; dealer concentration; product line coverage; unmapped customers; target units; and missing/stale/failed sync data. Check agreement between dashboard, RM report, filtered reports and automation snapshots.

Document a separate live reconciliation procedure: obtain explicit data-access authorization, an approved read-only extract and reporting period, approved voucher/return/cancellation definitions, RM/customer mappings and target units; compare control totals and exception lists; obtain finance/client sign-off. No live client data is accessed in this phase without that authorization.

### 4. Verify AI and WhatsApp with mocks

Exercise role scope and cross-team prompts, explicit periods, absent/stale data, provider timeout/error, schedule generation, recipient authorization/consent, opt-out, restart catch-up, duplicate claims, bounded retries, ambiguous delivery holds, signed and forged callbacks, callback order and scoped notifications. Keep test-only delivery configuration confined to mocked transports.

List real AI quality, STT language/accuracy, Meta template approval, account ownership, delivery/webhook configuration and recipient acceptance as separate live checks. Mock success does not verify these items.

### 5. Browser and mobile acceptance

Prepare a synthetic browser fixture server with no real integrations. Execute desktop and mobile viewport journeys where feasible; record browser, viewport, synthetic role, steps and observations. Responsive emulation does not establish physical-device GPS or microphone acceptance.

Manual checklist when execution is unavailable:

- Login/logout, invalid credentials, expired session and subsequent protected navigation.
- Role navigation, desktop/mobile menus, tables, dashboard and report-card rendering.
- Form required fields, invalid dates/numbers, successful save, validation errors and network errors.
- Report filters and CSV/Excel/PDF contents, including pagination and all expected rows.
- GPS allowed, denied, unavailable and timeout states; check saved location and attendance/visit behavior.
- Microphone allowed, denied and unavailable states; record/play protected audio and show transcription failure safely.
- Manager team access and denied other-team operations through actual UI journeys.

Mark unexecuted cases NOT VERIFIED, with an owner and acceptance procedure. Do not report browser or device PASS from source review.

### 6. Security and operational verification

Recheck authentication, role enforcement, cross-team isolation, sensitive data and audio access, session expiry, export escaping, errors and audit redaction. Exercise encrypted backup and restore only with synthetic disposable databases, a temporary encryption key and a new restore destination. Verify restored schema/data, integrity, wrong-key rejection and refusal to overwrite an existing destination.

Reuse [backup recovery guidance](../operations/database-backup-recovery.md) and [automation operations](../operations/PSSPL_REPORT_AUTOMATION.md). Separate tested code behavior from production configuration: storage/retention, recovery ownership, recovery objectives, monitoring, shared rate limits and startup migration approval remain operational decisions.

## Required final deliverables

Create `PSSPL_FINAL_UAT_REPORT.md` after execution with executive summary, all 142 requirement statuses, counts/percentage, full role workflow results, Tally reconciliation, AI/WhatsApp evidence, security/backup readiness, browser/mobile results, remaining defects, business approvals, deployment blockers and PASS / CONDITIONAL PASS / FAIL acceptance.

Create `PSSPL_CLIENT_APPROVAL_CHECKLIST.md` with decision, proposed rule or test, business owner, approval evidence, status and deployment impact. Include alert thresholds; Tally freshness and accounting definitions; RM aliases/ownership; target units; historical-period conventions; missed-visit policy; GPS acceptance; recording retention/language; lead lifecycle policy; complete PDF and Excel format acceptance; AI scope; WhatsApp recipients/consent/templates/schedule; backup/migration/monitoring; training; and final client sign-off.

Update `PSSPL_REQUIREMENTS_AUDIT.md`, both matrix files and `PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md` to the same reconciled totals and findings. Link execution evidence and distinguish synthetic verification from acceptance still requiring client/device/provider data.

## Completion criteria

- All 142 original IDs have an evidence-based classification and matching aggregate totals.
- Every requested workflow has an executed result or an explicit NOT VERIFIED entry and manual checklist.
- Failures, incomplete features and pending approvals are distinguishable and have actionable next steps.
- No unapproved database, credentials, provider, deployment or Git mutations occurred; preservation checks are recorded.
- Final report and client checklist exist and agree with the updated audit.
- Select PASS only when the scoped acceptance evidence supports it; use CONDITIONAL PASS for bounded verified scope with explicit outstanding conditions, and FAIL for critical failures. Never equate conditional local acceptance with production authorization.
- Report completed, partial, missing, broken and unverified counts, verified percentage, critical issues, approvals and final acceptance. Stop before Phase 9 and wait for the user's approval.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
