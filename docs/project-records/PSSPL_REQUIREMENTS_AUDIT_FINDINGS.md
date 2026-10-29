# PSSPL Requirements Audit — Findings and Validation

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Source: [PSSPL_REQUIREMENTS_AUDIT.md](./PSSPL_REQUIREMENTS_AUDIT.md).

This companion contains sections 5–12: completion findings, data/security review, and validation coverage.

## 5. Fully completed requirements

**21 requirements:** A01, A07, A10, A11, B18, C01, C10, C11, C12, C24, D01, D03, D07, DS03, DS04, DS05, DS07, DS08, E17, F15, F16.  Narrow source-verified capabilities are the admin shell and attention-card wiring, default underperformer-first presentation, dashboard-to-RM links, login/session flow, product/purpose/outcome persistence, support-request workflow, lead creation/value storage/Kanban, five exact supported stage presentations, API-fed charts and detail views, and connector freshness indicators.  These completions do not override the financial, security, integration or operational defects listed in other rows. No fully completed claim is based solely on a database table, mock entrypoint, screenshot, development plan or historical release note.
## 6. Partially completed requirements

**91 requirements:** A03, A04, A05, A06, A08, A09, A12, B01, B02, B03, B04, B05, B06, B07, B14, B15, B16, B17, C02, C03, C06, C07, C09, C13, C14, C15, C16, C18, C20, C21, C23, D02, D04, D06, D08, DS01, DS02, DS06, E01, E02, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E18, E19, F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12, F13, F14, F17, F18, G01, G03, G04, G05, G06, G08, H01, H02, H04, H05, H06, H07, H08, H09, H10, H11, H12, I01, I08, I09.  The matrix identifies the exact remaining work for each. Principal groups:
- **Accounting/reporting:** Real SQL aggregates exist but provenance, overlapping sources, target units, time windows and attribution disagree.
- **RM card:** Substantial detail UI, targets, trends, products, pipeline and visits exist, but they do not form one consistent report.
- **Field operations:** GPS attendance, visit completion and follow-ups persist, with gaps in day scope, state transitions, access checks and mandatory evidence.
- **Calls:** Storage/API and legacy call count exist, but the UI never invokes activity creation.
- **Pipeline:** Valid eight-stage persistence exists; assignment, history, follow-up linkage, closure evidence and error recovery are incomplete.
- **Audio/AI/automation:** Real integration code exists, but protected audio access, translation/transcript linkage, authorized AI context, schedule durability and provider delivery remain incomplete/unverified.
- **Security/reliability:** Scrypt, token hashing, role guards, some audit logging, cached reads and baseline restore exist; the complete confidentiality and recovery workflows do not.
- **Training:** Technical documentation gives module descriptions, not complete task-oriented instructions.
## 7. Missing requirements

**13 requirements:** C05, C08, C17, C19, D05, D09, I02, I03, I04, I05, I06, I07, I10.  No actual implementation found for physical-visit GPS verification, mandatory visits/calls, explicit English translation, mandatory voice-to-text notes, lead stage history, lead conversion reporting, and seven task-level/consolidated training SOP requirements. Searches covered src/server/schema/scripts and project documentation; this conclusion is repository-scoped. A scheduled call follow-up is not a completed call log; a generic next-action date is not synchronized follow-up scheduling; an â€œAIâ€ heading is not an LLM integration.
## 8. Broken or unverified requirements
### Confirmed broken requirements

**12 requirements:** A02, B08, B09, B10, B11, B12, B13, C04, C22, G02, G09, H03.

| Finding | Evidence and verification | Consequence |
| --- | --- | --- |
| Financial source addition | Actual buildTeam function executed with a stubbed read-only dataset: historical product sales 100 plus invoice sales 100 gives 200 E03. This demonstrates absence of overlap exclusion, not that every possible source pair overlaps. | Dashboard actual/achievement can double count overlapping workbook and invoice sources. A02.
| Wrong SQL bindings | pipelineKpi SQL has first placeholder for overdue date, then aliases/user IDs; actual call binds aliases/user IDs/date. Memory-only SQL probe returned expectedValue=0 instead of 1000. followUpKpi and pipeline list show same ordering defect by inspection. E04. | RM expected orders/follow-ups may be missing or mismatched; B08 and related partial metrics.
| Capped dealer analysis | Backend actualSales LIMIT50 â†’ frontend dealerMap. A 51-row fixture omits an older 10,000 sale while retaining 50 recent 1-unit sales. E05. | Incorrect top-five rankings, active dealer count and concentration; B09/B10/B13.
| Incorrect dormancy definition | Admin card uses customers appearing in visits but absent from actualSales; Manager Action Plan counts visit rows without deduplication. E05/E06. | Can miss unvisited dormant dealers, flag recent billed dealers whose invoice was omitted, and count visits as dealers; B11.
| Estimated new customers | Actual expression Math.floor(totalDealersCount*0.1) yields two new customers from 20 dealers without any dates. No customer-origin date exists in inspected master schema. E05. | â€œAdded in last 6 monthsâ€ is not a database calculation; B12.
| Wrong business-day boundary | Existing toISOString().slice(0,10) returns 2026-10-16 for 2026-10-17 00:15 IST. E13. | Attendance/visits/day summaries can use prior date for early IST hours; C04.
| All-open value labelled daily | buildSalesDay sums all open expected_orders with no day predicate. E19. | Daily expected-order value includes other days; C22.
| Cross-user follow-up update | Actual toggle handler extracted unchanged, supplied authenticated user A, executed against memory-only row owned by B; row changed. E32. | Sensitive record-level authorization is broken; H03.
| AI data/date leak | Actual buildContext function executed on a synthetic memory database: salesperson A receives product revenue from B's 2020 invoice in current-FY context. E30. | Product data is not scoped or date-limited despite role labels; G02/G09. |

These are deterministic source defects or isolated executions, not conclusions based only on untested features. No live exploit, real-user mutation, or external data transfer was attempted.
### Explicitly unverified requirements

**5 requirements:** E03, G07, H13, H14, H15.
- **E03:** Actual Windows-agent/Tally live exchange, selected company identity and data reconciliation.
- **G07:** Actual WhatsApp configuration, recipient, provider acceptance/delivery and scheduled execution.
- **H13:** Whether multi-client tenancy is applicable and how deployed isolation is enforced.
- **H14:** Authorization and controls for client data in development/testing.
- **H15:** NDA documentation/execution and external confidentiality obligations.  Other partial rows also identify runtime checks still required. In particular, no fresh authenticated browser workflow, mobile device test, real transcription, live AI answer, export rendering or backup restore was certified.
## 9. Tally integration and data accuracy assessment
### What exists

Server ingestion supports pairing, hashed bearer access/refresh tokens, heartbeat, sync-job status, resumable XML chunks and master extraction. Chunk ingestion distinguishes sales, credit notes (negative), payments and purchases. Finalization publishes staged records by clearing ingest_session_id and records freshness metadata. Stable IDs and upserts reduce basic duplicate inserts; admin Tally diagnostics expose missing masters, duplicate GUIDs, line variances and stale sessions.  Reports generally exclude invoices with non-null ingest_session_id, but **committed does not mean genuine Tally voucher**. The workbook importer explicitly writes reconstructed invoices as committed rows.
### Historical main-file evidence (not live state)

A Python SQLite URI opened `data/crm.sqlite` with `mode=ro&immutable=1` and query_only. The existing WAL was intentionally not read or checkpointed. No connection to application db.mjs was made.

| Aggregate | Main-file result |
| --- | --- |
| Committed invoice rows | 25,116
| Invoice date coverage | 15 April 2023 â€“ 8 September 2026
| Rows with source_sync_id=excel-import | 23,620
| Of those, reference=Monthly Sales Invoice | 868
| Of those, reference=RM Product Invoice | 22,752
| Other sync-source invoice rows | 1,496
| Staged invoice rows in this main-file view | 0
| Customers | 1,692
| Customers with null owner_user_id | 1,493
| Customers with missing/empty rm_name | 1,502
| customer_activities rows | 0 |

These counts are not production metrics and cannot establish the current WAL-inclusive database. “Other sync-source” is a source marker, not independent proof that amounts reconcile to Tally. The source-generation code plus persisted excel-import/reference markers provide evidence that reconstructed accounting rows are present in this historical local database.
### Accuracy/recovery risks

1. **Reconstructed vouchers:** Importer uses fixed day-15 dates, invented invoice/GUID strings, arbitrary customer/product allocations and uniform monthly splits. Aggregate workbook values may be genuine, but transaction/product/customer history inferred from them is not.
2. **Overlapping sources:** buildTeam adds tally_rm_product_sales and tally_invoices without source precedence; historical synthetic invoices may already represent those aggregate values.
3. **Cross-source identity:** Workbook slug IDs differ from connector name-hash IDs. Customer/product IDs are based on names; master IDs do not include company identity. RM fuzzy merging is not an approved identity registry.
4. **Current ownership rewrites history:** Reporting joins current customer owner/rm_name. Admin reassignment updates both fields; no effective-date history exists.
5. **Publication safety:** Chunk upserts update existing invoice rows to a new non-null ingest_session_id before finalize. Existing published vouchers can disappear from committed reports while a resync is unfinished/failed. Master creation and aggregate rebuilding also occur outside a single publication transaction.
6. **Voucher corrections:** Upserts do not delete old invoice lines removed from a corrected voucher. No explicit cancelled/deleted voucher handling or operational replace-mode cleanup was found; publication_mode is stored but not used to enforce replacement.
7. **Legacy XML path:** normalizeTallySnapshot takes absolute amounts and lacks the chunk path's negative credit-note sign. Date/cancellation/tax/rounding semantics require reconciliation fixtures.
8. **Totals:** Invoice amount may be the sum of stock-line values instead of full voucher total; taxes/charges/discount conventions require business agreement. Customer monthly legacy path uses voucherTotal logic that differs from line sums.
9. **Tokens:** Expiry columns are ISO strings containing T, compared with SQLite datetime('now') strings containing a space. Lexical same-day comparison needs correction/verification. No HMAC implementation supports the documentation claim.
10. **Replica:** Full-table Supabase upserts do not delete missing rows, enforce source SQLite foreign keys or demonstrate a recoverable backup. TLS certificate validation is disabled.  **Assessment:** Tally-derived integration is implemented in part, but authoritative voucher provenance, live synchronization and reconciled reporting accuracy are not established. Do not silently repair or delete reconstructed records during audit. Any future remediation requires a reviewed mapping/provenance and backup strategy.
## 10. Individual RM report-card gap analysis

| Metric | Current computation | Required reliable behavior |
| --- | --- | --- |
| Monthly target/actual | Invoice SUM plus fallback to latest active month; target table or raw-profile threshold/default | Explicit selected period and data-as-of; agreed target units; genuine source precedence; missing target shown as unavailable
| YTD target/actual | FY selector in UI; target sums and alternative historical fallback; static annual numbers in legacy print | Same financial-year cutoff for targets, invoices and activities; no hardcoded financial values
| Achievement/ranking | Actual/target arithmetic; team and management targets use different scales | One canonical numerator/denominator and comparable time scope
| Trends | Last 12 months having invoices; 2024 target/default reused if missing | Include zero-sales months; period-matched targets with missing-data indication
| Visits/calls | Admin visits scope by customer OR linked user; legacy calls count own activities; no call-entry UI | Defined RM/team scope, unique activity IDs, date-filtered calls/visits and no join multiplication
| Planned/completed | Created visits treated as planned; no versioned original plan | Agreed plan baseline, scheduled business date and completion event
| Follow-ups | Date-first placeholders bound incorrectly; open list capped50 | Correct scoped/count queries, complete paginated detail, due-date validation and authorized updates
| Top five / active dealers / concentration | Frontend groups latest50 invoices by display name | Full eligible backend aggregate by customer ID; top-five SUM divided by all eligible RM sales
| Dormancy | Admin visit/no-sales proxy; legacy invoice MAX90day list capped5; alert screen yet another query | One invoice-history rule, all assigned eligible dealers, deduplicated counts and explicit as-of/coverage
| New customers | 10% of active dealer count | Actual created/onboarded/first-invoice definition, reliable date provenance and six-month window
| Products | Requested-window query with fallback to hardcoded FY2025-26; thrust fallback can ignore dates | Consistent selected scope, verified invoice lines and no unrelated-history substitution
| Management actions | Deterministic text using flawed dealer/target data; duplicate visit-based dormant count | Stable evidence-based rules, linked dealer/RM evidence, action owner/due date/status and clear missing-data behavior
| Print/report parity | Admin PDF repeats capped dealer formulas; /api/rm/print-report hardcodes report date and annual financial metrics | All outputs consume the same validated report data, preserve filters and disclose provenance |
### 19% / 96% / two inactive dealers scenario

Existing rules would issue shortfall advice at achievement<50 and concentration advice above70, **if supplied those values**. They cannot reliably prove the supplied scenario because concentration is capped-row-derived and admin dormancy is not invoice-history-based.  Future acceptance fixture: target100, actual19 in one agreed unit; top-five eligible sales18.24 (96% of19); two assigned dealers with genuine invoices older than the agreed inactivity cutoff; at least51 invoice rows, including an older high-value dealer; a never-visited dormant dealer; a recent billed dealer with an invoice outside the first50 rows. Verify dashboard, RM card, dealer drill-down, management actions and exports agree. Also test zero/negative/net-return revenue and absent targets. No such complete end-to-end acceptance test was run or claimed during this audit.
## 11. Security, privacy and reliability assessment

**Present controls:** Scrypt, cryptographically random sessions, stored token hashes, active-user checks, idle/absolute expiry, selected Zod validation, parameterized values, admin/RM role guards, customer checks in several sales endpoints, limited admin audit redaction, file-size limits and cached-read error states.  **Confirmed or source-evidenced gaps:**
- Object authorization: follow-up patch/toggle by id alone; unchecked leadId relations; lead deletion removes other lead child rows before checking ownership; dormant-reason insertion checks no customer scope.
- AI access control: product SQL is global and improperly date-filtered; role-protected endpoint does not prevent context leakage.
- STT: unauthenticated route can invoke a paid provider; no explicit rate limit/provider timeout/type validation beyond upload limit. Do not test provider expenditure as part of audit.
- Uploads: multer writes audio before verifying visit ownership; helper returns success-looking JSON without checking HTTP status; no protected retrieval/lifecycle/durable storage.
- Authentication hardening: default seed fallback, no login throttling, session token in localStorage, CORS reflecting arbitrary origin. Existing password strength and deployment secret rotation not verified.
- Logging: successful admin mutations only; login/denied/field/export reads are not audited by that middleware.
- Data storage: SQLite and gzip baseline hold client/account data; audio saved on local disk. Disk encryption, service ACLs, retention, deletion and authorized handling not evidenced. This is not a finding that the operating system lacks encryption; it is an evidence gap.
- Replication: copies all tables, disables certificate validation and does not establish cloud RLS/ACLs or recovery. No external sync was triggered.
- Schema reproducibility: operating_city/reg_code_1/reg_code_2, dormant_reasons and special historical tables are created by separate scripts. Main-file DB has them; fresh normal initialization does not. Route failure on a schema lacking these columns/tables is deterministic from the SQL, but no migration or fresh startup was run.
- Durability: bundled baseline cannot recover changes after deployment; deployment docs warn about ephemeral filesystem. Backup retention, encryption, RPO/RTO and restore drills remain unverified.
- Downtime: last persisted SQLite supports connector-offline reads and displays freshness; failed/staged resync behavior and unsaved browser form/offline recovery are incomplete.
- Cache confidentiality: admin cache keys depend on loader/deps rather than principal; logout removes tokens/user but does not explicitly clear cache. Cross-account browser display behavior was not exercised.
- Client isolation: no tenant_id model found. A dedicated single-client deployment may be appropriate; actual applicability and account/storage isolation require deployment evidence.
- NDA: no NDA-specific repository evidence. This audit makes no legal compliance or execution claim.
## 12. Implementation quality and safe validation
### Checks executed in this audit

| Check | Method | Result / limit |
| --- | --- | --- |
| --- | --- |
|
---
|
---
|
---
| TypeScript | node_modules/.bin/tsc --noEmit --incremental false | Exit0; no emitted JS or tsbuildinfo update
| Existing provider tests | node --test scripts/ai-provider.test.mjs | Five provider subtests plus parent passed; fetch mocked, NODE_ENV production, test keys only; no real provider request
| Existing attendance tests | node --test scripts/attendance-live.test.mjs | Five passed; in-memory SQLite and transpileModule in memory; no file database imported
| Combined existing test output | Above test files | 11 reported tests, 11 pass, zero fail
| Follow-up authorization probe | Actual source handler extracted; fake authenticated req; synthetic :memory: DB | Confirmed another user's row changed
| RM pipeline binding probe | Exact extracted SQL, synthetic :memory: tables, actual argument order vs intended | Actual0/null vs intended1000/1
| AI context probe | Actual buildContext source with injected :memory: DB | Confirmed global historical product leak; first harness attempt lacked owner_user_id and failed, corrected fixture passed; initial harness error is not an application defect
| New-customer expression | Actual expression extracted and evaluated | 20 active dealers â†’ 2 â€œnewâ€ without dates
| Invoice-cap illustration | Synthetic51-row algorithm fixture | Demonstrated omission of highest dealer; not a live API test
| STT/cron static assertions | Inspected mounted route and schedule source | No STT auth; no explicit cron timezone
| Team addition probe | Actual buildTeam function; deterministic read-only query stub | 100 historical +100 invoices â†’200
| Target/date expressions | Existing conversion/date formulas evaluated | 100Ã— target scale mismatch; IST early-morning date shifts to prior UTC day
| Historical DB inspection | Python immutable read-only main-file connection | Aggregate/schema only; WAL intentionally excluded; no live-current claims
| Source preservation | SHA-256 comparison of existing application/docs/config/data files before tests and after report | Recorded at final validation below |
### Feature-level quality coverage

For each matrix row, the evidence trace and Missing Work evaluate applicable UI existence/wiring, endpoint logic, persistence/readback, data provenance, validation, error handling and access checks. COMPLETED is narrow source verification; runtime limits apply across each group.

| Group | Source coverage and main quality limits | Runtime coverage |
| --- | --- | --- |
| A/B dashboards/card | UI/API/SQL traced; calculations, scope, caps and fallbacks examined | In-memory isolated KPI/algorithm probes only; no authenticated browser rendering
| C mobility | Permission/error branches, form fields, API mutations and tables traced | No real GPS/microphone/device test; no actual activity written
| D pipeline | Create/update/read enum and ownership/child relations traced | No browser drag/drop or full lifecycle test; no conversion/history tests exist
| E Tally | All server connector actions, XML paths, tables, importer and replica reviewed | No live agent/Tally exchange, imports/replays or paid/external actions
| F reporting | Main SQL dimensions, filters, joins, caps, export handlers and drill-down traced | No export/PDF visual rendering; no real-client financial reconciliation
| G AI/automation | Provider calls, context SQL, routes, cron and WhatsApp sender traced | Mocked provider tests and in-memory context only; no live transcript/answer/message
| H security/reliability | Role/session/object logic, data paths, startup side effects, logs and recovery reviewed | Isolated cross-user follow-up probe; no live attack, restore or deployment check
| I training | Repository documentation inventory and targeted searches | No training delivery or client sign-off evidence |  **Intentionally not executed:** npm run dev/start/start:api, npm run build (writes generated output), db:migrate/db:status/db:setup, imports/seeds, exports that write schema, real-ledger verification scripts importing db.mjs, verify-my-day-http (creates sessions), verify-attendance-latency (creates snapshot and starts app with migration side effects), connector/replica scripts, live messages/providers.  Historical verification reports in docs were read as historical claims only; their tests were not silently counted as fresh passing checks. No comprehensive endpoint/browser regression suite or CI test script was found in package.json. Safe unit checks passing do not establish a complete end-to-end CRM. 

## Phase 7 reconciliation - 17 October 2026

The findings and roadmap above retain their original review/planning context. For current AI, automation and SOP implementation, use [E40](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e40), [matrix part 2](./PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md) and [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md). Role-scoped complete AI context, selected dates, server-rendered evidence, durable recipient-specific schedules/retries/callbacks, in-app reminders and the three SOPs are implemented and covered by synthetic/mocked tests. These replace the earlier missing-implementation descriptions within that scope.

Broader BI/alias parity, approved recipient lists/consent/templates/schedules, supported provider configuration, live delivery, controlled migration/backup rollout, browser acceptance and delivered training remain open. SOP document completion is not training sign-off. Baseline completion counts were not recalculated; production readiness and final UAT are not inferred.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
