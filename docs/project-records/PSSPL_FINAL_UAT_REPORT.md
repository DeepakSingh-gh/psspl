# PSSPL final UAT report

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Date: 18 October 2026 (Asia/Kolkata)
Branch: `feature/psspl-phase3-rm-report-cards`
Revision assessed: `87eae1ec68bccb8b11e2950bafecc8ccc81da508` plus existing local Phase 1-7 changes and Phase 8 verification artifacts.
Final UAT acceptance: **FAIL**.

## 1. Executive summary

Phase 8 verification and requirements reconciliation have been executed locally. The system has substantial working synthetic API coverage, but final acceptance is blocked by a reproduced clean-initialization failure and outstanding browser/device, accounting, provider and client approval evidence. Phase 9 has not started.

All **76 automated tests pass**, along with the isolated My Day smoke test and TypeScript check. Passing tests include assertions that deliberately reproduce known application defects; green test results do not mean those defects are fixed. The main workflow fixture explicitly adds three missing profile columns so that compatible-schema paths can be exercised. A separate fixture without that shim confirms the failure.

**Critical finding UAT-01:** a fresh database initialized by the current backend accepts synthetic login but `/api/salespeople/me/my-day` returns HTTP 500. Startup omits `salesperson_profiles.operating_city`, `reg_code_1` and `reg_code_2`. Existing deployments may already have these columns; the existing CRM database was not started or migrated to determine its state.

**Reporting finding UAT-02:** India-local month-start dates serialize to the previous day through the report preset's `toISOString().slice(0, 10)` pattern. For example, 1 October 2026 midnight in India becomes `2026-09-30`. Explicit backend filter tests pass; the preset is defective.

## 2. Reconciled requirements and percentage

| Classification | Requirements |
| --- | ---: |
| COMPLETED | 28 |
| PARTIALLY COMPLETED | 103 |
| NOT IMPLEMENTED | 5 |
| BROKEN | 1 |
| NOT VERIFIED | 5 |
| **Total original baseline** | **142** |

**Verified completion = 28 / 142 x 100 = 19.72%.**

The full 142-row matrix appears in Appendix A and in the updated [original matrix](./PSSPL_REQUIREMENTS_AUDIT_MATRIX.md), [continuation](./PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md) and [machine-readable reconciliation](../uat/phase8/requirements.json). All original IDs and requirement wording are preserved.

The earlier 21/142 audit summary and 46/142 intermediate matrix labels were not final UAT results. This reconciliation applies a stricter acceptance boundary: a working API with a required browser/device/provider journey still awaiting execution remains partial. This change in counting is not evidence of code regression. COMPLETED rows certify narrow persisted field/stage behavior or authored SOP content for which synthetic/source evidence is sufficient; they do not certify all-screen acceptance, real data or production configuration.

The five missing requirements are **B12, C05, C08, C17 and C19**. The broken requirement is **C20** for the fresh-schema daily-summary path. The five NOT VERIFIED requirements are **E03, G07, H13, H14 and H15**. Individual browser cases are also NOT VERIFIED even where their parent requirement has a working partial implementation.

Separate September 1, 8 and 26, 2026 meeting records remain unavailable. Reconciliation uses the existing 142-row baseline and supplied Phase 8 instruction; it cannot establish independent meeting provenance or client sign-off.

## 3. Executed verification and evidence

Reproduce using `node scripts/phase8-run-uat.mjs`. It runs suites in isolated child processes, removes inherited provider/replication credentials, preloads loopback-only real networking and supplies a disposable fallback database. Individual suites create their own synthetic databases. STT/AI/WhatsApp success uses mocks, including a synthetic STT response in the full-app fixture. Audio files are confined to the fixture's temporary working directory.

| Check | Fresh result | Evidence |
| --- | --- | --- |
| Phase 1 security and encrypted restore | 10/10 PASS | [Log](../uat/phase8/phase1-security.log) |
| Phase 2 Tally/API reconciliation | 6/6 PASS | [Log](../uat/phase8/phase2-tally-accuracy.log) |
| Phase 3 RM intelligence | 4/4 PASS | [Log](../uat/phase8/phase3-rm-report.log) |
| Phase 4 management intelligence | 8/8 PASS | [Log](../uat/phase8/phase4-management.log) |
| Phase 5 field workflows | 5/5 PASS | [Log](../uat/phase8/phase5-field-workflows.log) |
| Phase 6 leads | 2/2 PASS | [Log](../uat/phase8/phase6-leads.log) |
| Phase 6 filtered reports | 2/2 PASS | [Log](../uat/phase8/phase6-reports.log) |
| Phase 7 mocked AI/automation | 19/19 PASS | [Log](../uat/phase8/phase7-automation.log) |
| AI transport behavior | 7/7 PASS | [Log](../uat/phase8/ai-provider.log) |
| Attendance monitor | 5/5 PASS | [Log](../uat/phase8/attendance-live.log) |
| Phase 8 full-app and defect checks | 8/8 PASS, including confirmed defects | [Log](../uat/phase8/phase8-workflows.log) |
| Standalone My Day, compatible synthetic schema | HTTP 200 | [Log](../uat/phase8/phase6-my-day.log) |
| Local TypeScript compiler | PASS, no incremental writes | [Log](../uat/phase8/typescript.log) |

Commands, exit codes, durations and preservation results are in [results.json](../uat/phase8/results.json). A test count refers to Node test cases, not a claim of 76 browser journeys or 76 independently accepted requirements.

## 4. Role workflow results

| Role | Workflow | Actual result and limit |
| --- | --- | --- |
| All | Real login, invalid input/password, identity, logout and expiry | HTTP PASS for synthetic admin, RM and two salespeople; wrong credentials rejected, revoked/expired sessions denied. Browser UX NOT VERIFIED |
| Admin | Dashboard KPIs, RM ranking, attention and report-card detail | Endpoint/calculation PASS in P2/P3/P4; shared MTD/FYTD parity and full dealer aggregation checked. Rendered ranking, navigation and charts NOT VERIFIED |
| Admin | Filtered sales reports and saved reports | P6 validates FY/date/customer/product/RM-team/territory/dealer filtering and 105 groups; P8 verifies 1000 sale less 100 credit note = 900. UI presets have UAT-02 |
| Admin | CSV/Excel/PDF | Complete API aggregates and CSV escaping reviewed; actual downloads/Excel interpretation/PDF rendering NOT VERIFIED. Print/PDF still follows paginated view |
| Admin | Ask AI and WhatsApp configuration | Authorized/denied API paths, scoped mocked AI and protected schedule lifecycle PASS in P7. Actual dashboard UX and live providers NOT VERIFIED |
| RM | Team visibility and customers | P1/P2/P8 allow assigned-team data and deny other-team customer/lead/admin access. Browser team navigation NOT VERIFIED |
| RM | Report cards, dealer intelligence, activity and follow-ups | P2/P3/P4/P7 check assigned scope, invoice history, concentration, attention and reminders. Actual UI interactions and physical activity accuracy NOT VERIFIED |
| Salesperson | Check-in, visit, call, follow-up, daily summary and checkout | Full-app P8 saves attendance, rejects duplicate check-in, creates/starts/completes visit, saves product/outcome/order/follow-up, records call, updates summary and completes checkout. Other-owner and invalid/repeated transitions denied. Compatible schema required |
| Salesperson | GPS | Synthetic valid coordinates/accuracy persist and invalid coordinates fail; actual permissions/location accuracy NOT VERIFIED |
| Salesperson | Recording and transcription | Original synthetic audio bytes upload and round-trip; other-user audio denied, team download protected with no-store. Authenticated multipart STT returns mock text. Microphone/codec/recognition quality NOT VERIFIED |
| Salesperson/RM | Leads and conversion | P6/P8 create and advance leads, verify six history entries and conversion, deny other-owner mutation and check assignment scope. Linked lead reminders/closure fields remain incomplete |
| Fresh schema | Login to daily summary | **FAIL: login HTTP 200 followed by My Day HTTP 500**, without test-added profile columns |

## 5. Tally reconciliation

Synthetic verification confirms shared signed eligible invoice/header and line rules, exclusion of staged and known `excel-import` projections, rupee/lakh/crore conversions, April-March financial-year boundaries, MTD/FYTD agreement, owner/team isolation, top-five dealer concentration, complete dealer aggregates beyond the 50-row detail list and complete report aggregates beyond 100 groups. Missing targets/mapping and missing/old/failed sync metadata remain explicit rather than fabricated.

Live Tally correctness is **NOT VERIFIED**. Cancellation state is not represented; stable company/customer/product identity, historical RM attribution, invoice-line completeness, target coverage and live ingestion replay/interruption still require reconciliation. New-customer origin is absent, so B12 is NOT IMPLEMENTED; the prior fabricated estimate has been removed and null is now truthful.

Separate approved real-data procedure:

1. Obtain explicit authorization for a read-only extract, approved company/period, secure destination, named operator and retention. Confirm original meeting/accounting definitions.
2. Obtain invoice headers/lines, sales returns/credit notes/cancellations, customer/product masters, monthly RM targets, source sync/run metadata and signed client control totals. Do not treat workbook projections as actual vouchers.
3. Review company/voucher IDs, duplicate/cancellation rules, tax/gross/net meaning, units, RM/team/customer mapping, unmapped exceptions and historical ownership with Finance.
4. Compare count/net value by period, dealer, RM and product; reconcile dashboard, report card, filtered exports and same-period automation. Check line/header differences separately rather than concealing them.
5. Record all variances and coverage/freshness exceptions, obtain Finance and Palak Ma'am's sign-off, and approve any remediation before changing existing data or rollout.

## 6. AI and WhatsApp

P7's 19 mocked tests cover role-scoped authorized facts, cross-team prompt isolation, dates/FY rollover, unavailable data, source/sync age, fabricated-provider-output rejection, provider failure, request validation and throttling. Seven bounded aggregate evidence sections and deterministic CRM review actions are supported; arbitrary BI/causal advice is not accepted.

Mocked automation covers India-time daily/prior-month scheduling, monthly restart catch-up, occurrence uniqueness, concurrent claims, recipient authorization/opt-out/inactive state, bounded explicit-rejection retries, recovery, ambiguous-send holds, disabled transport, template bounds, notification scope, signed/forged callbacks and callback arrival ordering. Provider acceptance is distinct from delivery/read.

No real provider call or message was sent. Live AI/STT quality, Meta account ownership/consent/template/version/webhook/delivery, schedule operation and recipients remain unverified. Shared alias/target parity and multiworker rate-limit configuration remain open. Delivery must remain disabled until the separate approvals and live tests are complete.

## 7. Security and backup readiness

Authentication, role/team/object denials, protected audio, session revocation/expiry, AI scope and redaction are covered by P1/P7/P8. Old audit descriptions of unauthenticated STT and disabled replication certificate validation are superseded: STT is authenticated and `server/supabase-sync.mjs` uses `rejectUnauthorized: true` in source. That source review is not a live TLS certification.

Disposable encrypted backup/restore verifies expected rows, SQLite integrity, tamper and wrong-key rejection, existing-target refusal, missing-configuration failure and stale-temp handling. Production-equivalent recovery is **NOT VERIFIED**: durable off-host storage, scheduling, key escrow, retention, alerts, RPO/RTO and audio recovery need configuration and drills. Replication is not backup.

Startup safety guards pass a disposable existing-production-database refusal test, but development startup still applies migrations. UAT-01 also proves that current initialization is incomplete. Do not start the normal backend on the existing CRM database as a remediation shortcut. Production API URL/CORS/HTTPS, secret-managed initialization, storage access, complete audit coverage and monitoring remain deployment blockers.

## 8. Browser and mobile results

**NOT VERIFIED.** Tool discovery returned no browser surfaces; requesting the in-app browser returned `Browser is not available: iab`. No desktop/mobile viewport, browser login/logout, form, chart, export, GPS permission or microphone permission result is claimed.

The [manual acceptance checklist](../uat/phase8/browser-mobile-checklist.md) provides 20 cases with role/device, steps, expected evidence and owners. Physical Android/iOS location and microphone/codec tests must be recorded separately from responsive emulation. API tests do not establish physical visits or actual calls.

## 9. Remaining defects and incomplete requirements

| Finding | Severity | Evidence and required resolution |
| --- | --- | --- |
| UAT-01 fresh-schema daily summary fails | P0 release blocker | P8 confirms real login succeeds, then My Day HTTP 500 without compatibility columns. Complete reviewed initialization/migration coverage and rerun without a shim; existing-data migration needs separate safety approval |
| UAT-02 India date presets shift a day | P1 reporting defect | P8 reproduces source date pattern; use India/local calendar serialization and retest month/last-month/FY boundaries |
| UAT-03 full export acceptance incomplete | P1 reporting gap | Source uses HTML .xls and paginated print/PDF; approve required format and implement/test complete output if required |
| UAT-04 customer-origin metric absent | P1 missing requirement | B12 returns null because reliable origin date is unavailable; approve actual origin source and six-month definition |
| UAT-05 physical/mandatory/translation gaps | P1/P2 policy and implementation gaps | C05 GPS verification, C08 mandatory logging, C17 English translation and C19 mandatory voice-to-text are absent |
| UAT-06 operational/report lifecycle gaps | P1 readiness gaps | Unapproved thresholds/mappings, linked lead reminders/closure policy, audit completeness, portability, recovery and browser/live-provider evidence remain open |

Defects are documented rather than repaired as unrelated feature work in this verification phase. Existing Phase 1-7 application code is preserved. Expected-defect tests passing means the failure is reproducible, not resolved.

## 10. Business decisions and client approvals

The [client approval checklist](./PSSPL_CLIENT_APPROVAL_CHECKLIST.md) contains 28 pending items, covering scope/meeting records, defect remediation, accounting reconciliation, mappings/units, thresholds/freshness, visits/GPS, recording/language, pipeline, segmentation/export formats, AI scope, messaging consent/template/cadence, migration/recovery/security, confidentiality, browser/device acceptance, training and final sign-off.

Authored SOP content is complete for I01-I10. Training delivery, demonstrated competence and signed acceptance have not occurred. No client approval is inferred from a passing local test.

## 11. Production blockers and safety record

Production preparation requires at least UAT-01/UAT-02 resolution, accepted complete schema/migration/recovery procedures, approved live Tally control totals and mapping/targets, desktop/mobile/device acceptance, approved operational/security configuration and explicit client acceptance of all remaining scope gaps. Live AI/STT/WhatsApp tests require their own authorization; messaging remains off.

The isolated verification run hashed 241 existing inputs before and after execution and found **zero changed existing files during that test window**. Baseline count and results are retained in results.json; a temporary private hash manifest is retained locally. A later final comparison found changes to the existing database WAL/shared-memory files, while the database main file, application code and credentials/configuration still matched. Process inspection then showed a normal npm development runner and watched `.env` backend that were absent at the initial inspection. Phase 8 tools did not launch these processes and did not stop them. Their activity is concurrent external state, not verified UAT evidence; no inference is made about business-row or migration changes. **Whole-session database preservation cannot be certified.** The final preservation artifact records these differences explicitly.

Phase 8 tools invoked no existing-database startup, migration, seed, production-data mutation, credential/.env edit, real external integration, deployment or Git mutation. Tests created only disposable synthetic schemas/data and temporary audio. Intended audit/report updates are listed in the preservation artifact. No application watch process was active before work began; one appeared after the isolated verification window. Do not run additional migration/startup checks against that live process.

## 12. Final acceptance

**FAIL for final UAT.** Synthetic code/API verification passes within the documented compatible-schema scope. The clean-start daily-summary failure, date-preset defect and outstanding required acceptance evidence prevent full acceptance and production readiness.

Phase 8 local verification deliverables are complete. Fix and retest defects and obtain the listed acceptance evidence before changing this decision. **Do not begin Phase 9 without the user's explicit approval.**


## Appendix A Full requirements matrix

The full 142-requirement matrix, with the original evidence and acceptance notes, is maintained in [PSSPL_FINAL_UAT_REQUIREMENTS_MATRIX.md](./PSSPL_FINAL_UAT_REQUIREMENTS_MATRIX.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
