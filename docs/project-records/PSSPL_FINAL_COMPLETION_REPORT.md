# PSSPL Final Completion Report

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Assessment date: 18 October 2026. Branch: `feature/psspl-phase3-rm-report-cards`.

## Overall result

PSSPL has substantial working functionality and its isolated automated/browser/build checks pass. It is **not fully complete and is not ready for production launch**. The reconciled 142-requirement matrix has 30 completed, 102 partial, 5 not implemented, 0 broken and 5 not verified. A passing synthetic test does not establish client acceptance, live integration, legal evidence or production configuration.

No new numbered development phase was created. No deployment, push or commit was performed.

## Work completed and verified

- Hardened `server/db.mjs`: when test mode opts into `CRM_TEST_DATABASE_ROOT`, the database path and the root must be inside the operating system temporary directory, and the database must be inside that root. A repository database path is rejected before SQLite opens it.
- Hardened both existing regression runners to clear inherited database-path settings, assign a separate temporary SQLite path per suite, and pass the explicit temporary root. The run report now separates test-owned application file changes from protected database/WAL differences observed during the same time window.
- Added `scripts/db-isolation.test.mjs`. Its negative cases confirm that both a repository database target and repository directory as test root are denied; its positive case creates and opens a disposable database under temp. Result: PASS.
- Added real Tally connector route tests in `scripts/phase2-tally-accuracy.test.mjs`: exact chunk retry, same voucher in a subsequent chunk, and an updated voucher replay in a new session all leave one invoice/line and update the stored amount to the newer source value. These tests stop before import finalization, which can invoke an external replication hook. E16 remains partial because company-scope collisions, partial-failure recovery and staged replacement are not covered.
- Full regression: **87 automated cases passed, 0 failed** across the Phase 1-9B suites, including 2 Playwright Chromium tests on desktop and mobile browser viewports. TypeScript passed. The browser harness completed a production build in a temporary copy and served it for browser tests. `npm audit` reported 0 known vulnerabilities.
- Requirement matrix integrity check: 142 unique IDs; counts sum to 142. The row-level evidence and primary work classification are in [PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md](./PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md). The earlier Phase 9B browser evidence remains viewport simulation; it is not physical-device UAT.

Run evidence is in `docs/uat/phase9/results.json`, suite logs in `docs/uat/phase9/`, and browser artifacts in `docs/uat/phase9b/`.

## What is fully completed

**30 requirements are marked COMPLETED** under the existing evidence boundaries. This does not mean the whole application or release is complete. The matrix distinguishes completed narrow code/workflow behavior from acceptance of live accounting totals, production setup or every screen. F08 region filtering and F17 report downloads were verified in a synthetic Chromium browser run. No requirement was promoted to complete based only on this final hardening work.

## What is genuinely incomplete

**102 requirements remain PARTIALLY COMPLETED.** They include unverified screen/workflow details; approved targets, roster, customer/territory mappings and metric definitions; call and lead lifecycle gaps; Tally import/recovery edge cases; cross-screen report parity and full portability; audit, offline recovery, storage, backup and production security operations; and training delivery/acceptance. The matrix gives each row its evidence, remaining work, owner/dependency and acceptance criteria. Development-ready code slices remain; they are not silently treated as client blockers or as finished.

**5 requirements remain NOT IMPLEMENTED:** B12 new-customer origin/date metric, C05 physical-visit GPS verification, C08 mandatory daily activity logging, C17 English transcription/translation, and C19 mandatory voice-to-text. Their required source data or policies are not available in this repository, so defaults cannot safely be invented.

## What is blocked by the client

The exact decision requests are in [PSSPL_CLIENT_DECISION_REGISTER.md](./PSSPL_CLIENT_DECISION_REGISTER.md). The five requirement blockers above need the following:

- **B12:** authoritative customer-origin date and six-month/backfill definition.
- **C05:** approved coordinates, geofence/accuracy policy, retention, exceptions and physical-device criteria.
- **C08:** required activity rules, India-local cutoff, exceptions, escalation and override policy.
- **C17:** supported languages, whether translation is required, approved provider/privacy treatment and acceptance quality.
- **C19:** covered interactions, consent, exemptions, failure behavior and audio/transcript retention/deletion policy.

Options in the register are proposals for the client to select. No client approval or deferral is recorded.

## What is unverified

**5 requirements remain NOT VERIFIED:** E03 live Tally synchronization; G07 real WhatsApp delivery; H13 whether client tenancy isolation applies and, if it does, deployed proof; H14 historical authorization/disposition of client data in development/testing; and H15 NDA evidence through an authorized legal channel. These are separate from the five not-implemented policy/data requirements.

Physical Android/iOS GPS and microphone behavior, alternate mobile browsers, client role/territory acceptance, live finance control totals, provider delivery, production HTTPS/secrets/storage/monitoring, production-equivalent recovery, and client sign-off also remain unverified. The controlled [Tally and WhatsApp UAT plan](./PSSPL_LIVE_INTEGRATION_UAT_PLAN.md) is preparation only; no external provider or customer was contacted.

## Database isolation and preservation note

The test database guard and new regression prove that the configured test path cannot point to a repository database when the guard is enabled. During full regression, application/config files had zero hash changes. Workspace and `.env`-configured SQLite WAL/shared-memory hashes differed during the test window while an already-running `.env`-backed development backend was present; the runner cannot attribute those differences to a specific concurrent process. The main workspace SQLite file and environment-file hashes did not appear in the runner’s changed-file list. Tests themselves used temporary database paths; no test was intentionally run against the configured CRM database. This report does not claim whole-window preservation of WAL/SHM files or database-content integrity. Have the database owner arrange a quiet/isolated verification window before relying on whole-workspace preservation hashes.

## What you must do personally

1. Ask the named business/data owners to decide or explicitly defer B12, C05, C08, C17 and C19, and record approver/date in the final checklist.
2. Arrange authorized, least-privilege Tally and WhatsApp sandboxes (and the test recipient/consent for WhatsApp), or accept that E03/G07 remain unverified.
3. Ask the data/legal owner to resolve H13 applicability, H14 data-use authorization/disposition and H15 evidence review in the approved channel.
4. Provide approved UAT users, role/territory mappings, finance control totals and supported physical devices; appoint QA, IT/security and rollback owners.
5. Review the resulting evidence and sign or reject the acceptance checklist. Client decisions and legal approvals cannot be supplied by code changes.

## Exact remaining steps before production launch

1. Record client decisions or signed deferrals for the five requirements; implement each approved behavior and add requirement-specific tests.
2. Run Tally reconciliation in an authorized read-only sandbox against approved company, period, voucher rules, mapping and control totals; expand E16 tests for company collisions, partial failure and replacement.
3. Run WhatsApp only in an authorized provider sandbox with the approved test recipient/template; verify consent, signed callbacks, ambiguous outcomes, opt-out and disable/rollback. Keep customer messaging disabled until separate explicit authorization.
4. Resolve H13–H15 applicability/evidence and complete security/data-owner review.
5. Execute all applicable role, browser and physical-device cases in [PSSPL_FINAL_CLIENT_UAT_CHECKLIST.md](./PSSPL_FINAL_CLIENT_UAT_CHECKLIST.md); fix failures and retain restricted, redacted evidence. Record accepted limitations by requirement ID.
6. In an approved staging copy, review every migration and startup action, test backup/restore and rollback, then verify production HTTPS/origin/secrets, storage/retention, audit, monitoring and recovery objectives. Do not use the current configured database as an unreviewed test target.
7. Re-run the full isolated regression/build/audit after approved fixes, record a stable preservation comparison in a quiet or isolated environment, and obtain business/IT sign-off.
8. Only then schedule a separate, explicitly authorized production change window with a named operator, backup, rollback owner and post-deploy smoke tests. This work does not authorize or perform deployment.

## Final readiness decision

**NO-GO for production launch at this time.** Engineering checks pass in isolated synthetic environments, and the test-database isolation issue has been hardened. Client decisions, live integrations, physical-device/client UAT and deployment/recovery evidence still prevent a defensible production approval.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
