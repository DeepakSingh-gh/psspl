# PSSPL Requirements Audit — Evidence Register

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Current status authority: [Phase 8 E41](#e41) and the [final UAT report](./PSSPL_FINAL_UAT_REPORT.md). E01-E40 preserve historical traces and are superseded where fresh Phase 8 findings differ.

Source: [PSSPL_REQUIREMENTS_AUDIT.md](./PSSPL_REQUIREMENTS_AUDIT.md).

This is section 4 of the full audit. It preserves the source references and end-to-end traces.

## 4. Evidence register and end-to-end traces
<a id="e01"></a>
### E01 â€” `src/components/admin/admin-shell.tsx:70`

AdminShell â†’ authApi.me (`src/lib/api.ts:66`) â†’ GET /api/auth/me (`server/app.mjs:75`) â†’ sessions/users (`server/auth.mjs:101`); adminRouter additionally requires admin (`server/admin.mjs:460`). App Router pages mount overview/team/customers/products/activity/reports/users/Tally/audit components.  <a id="e02"></a>
### E02 â€” `src/components/admin/admin-team.tsx:16`

AdminTeam â†’ adminApi.team â†’ GET /api/admin/team (`server/admin.mjs:535`) â†’ buildTeam; default sortOrder='asc', achievement sorting at lines 21â€“24; name Link at line 238 â†’ /admin/team/[id] â†’ AdminRmDetail (`admin-rm-detail.tsx:1459`) â†’ rmDetail API (`src/lib/api.ts:111`) â†’ GET /api/admin/team/:id (`server/admin.mjs:551`).  <a id="e03"></a>
### E03 â€” `server/admin.mjs:292`

buildTeam reads tally_rm_targets, tally_rm_product_sales, committed tally_invoices, tally_customers, tally_salespeople, users/profiles and field tables. Historical product totals are added at lines 324â€“334, then invoices added again at 344â€“361. Profile target Ã— LAKH at 407 versus Ã— CRORE in management reports (1126); team targets sum all FY target rows. rm-directory.mjs:60â€“139 groups spellings with edit distance â‰¤2, strips field/rep/salesperson suffixes and merges CRM names. No effective-dated ownership.  <a id="e04"></a>
### E04 â€” `server/admin.mjs:551`

AdminRmDetail periodDates (lines 38â€“62) â†’ adminApi.rmDetail â†’ /api/admin/team/:id. visitsKpi 595, pipelineKpi 608, followUpKpi 619, uncapped sales SUM 627, anchoring 638, target inference 672, hardcoded monthlyTarget fallback 693; dailyActivity 697â€“721 joins orders/follow-ups by user OR customer (multiplication risk, no selected date predicate); monthly history 880â€“917 omits months without invoices and falls back to 2024 target/default.  <a id="e05"></a>
### E05 â€” `src/components/admin/admin-rm-detail.tsx:668`

Report-card dealerMap groups data.actualSales by customerName, ranks top five, counts Object.keys, computes dependencyPct and estimates newCustomersCount at
683. Dormancy at 690â€“704 uses visited customers absent from the capped sales list. Backend actualSales at server/admin.mjs:752â€“771 has LIMIT 50 in both dated and all-history fallback queries. Individual dealer percentage at frontend 1101 divides by top-five total, not all sales.  <a id="e06"></a>
### E06 â€” `src/components/admin/admin-rm-detail.tsx:1202`

InsightPanel constructs deterministic text from KPI values, not an LLM request. ManagerActionPlanTab at 1271 uses capped actualSales and undeduplicated customerVisits; thresholds: achievement <50, concentration >70, dormant visits >0, overdue follow-ups. rm-report-pdf.tsx:117â€“175 repeats those calculations. No persisted action owner/deadline/closure workflow.  <a id="e07"></a>
### E07 â€” `src/components/admin/admin-activity.tsx:20`

AdminActivity â†’ adminApi.activity â†’ GET /api/admin/activity (`server/admin.mjs:1433`), retrieves visits/follow_ups (LIMIT 100), attendance (60-day scope). Overview aggregates field tables (`server/admin.mjs:497â€“505`); customer_activities calls are not consolidated into its activity counters. No call-log form invocation found anywhere in src.  <a id="e08"></a>
### E08 â€” `src/components/admin/salesperson-map.tsx:47`

SalespersonMap dynamically imports Leaflet, draws API-derived positions and escaped popups. AdminOverview mounts it at 215. /api/admin/overview latest location subqueries at server/admin.mjs:505 read location_pings/attendance; admin activity movement endpoint at 1449 returns route points. Device/browser GPS accuracy, background execution and map rendering were not exercised.  <a id="e09"></a>
### E09 â€” `src/components/admin/admin-overview.tsx:95`

AttentionCard renders persisted overview/alerts data (228â€“242). AlertsBody (`admin-alerts.tsx:11`) â†’ adminApi.alerts â†’ GET /api/admin/alerts (`server/admin.mjs:1100`) queries missed attendance, overdue follow_ups/orders, MAX invoice_date dormancy and shortfalls. Target shortfall route selects role=salesperson only and scales profile target Ã— CRORE.  <a id="e10"></a>
### E10 â€” `server/rm-routes.mjs:85`

Legacy RmReportCard (`src/components/rm/rm-report-card.tsx:56`) â†’ rmApi.reportCard â†’ /api/rm/report-card, guarded by authenticate/requireRole('rm') at line
7. Calls at 162 count customer_activities.activity_type='call'; top dealers aggregate full eligible invoices at 200 but pctShare denominator is only top five at
222. Dormancy at 228 uses invoice MAX date and 90-day cutoff, LIMIT 5. /api/rm/dashboard aggregates owner-user/team data at 66â€“81. /rm redirects to shared My Day (`src/app/rm/page.tsx:5`), but legacy detail pages remain.  <a id="e11"></a>
### E11 â€” `server/admin.mjs:1115`

AdminManagementReports â†’ adminApi.managementReports â†’ /api/admin/management-reports â†’ tally_customers/invoices/expected_orders/profiles/purchases. Dealer period/year comparison uses activeMonths, previousSalesValue, MAX date and LIMIT 250; team report uses owner_user_id and target Ã— CRORE, while Team uses RM aliases and Ã— LAKH. Generic party_type shown, no dedicated distributor or direct-customer segment/filter.  <a id="e12"></a>
### E12 â€” `server/auth.mjs:7`

LoginForm (`src/components/auth/login-form.tsx:15`) â†’ authApi.login â†’ /api/auth/login (`app.mjs:74`) validates email/password, users.active and asynchronous scrypt; createSession at 93 uses random 32-byte token with SHA-256 stored hash. authenticate at 101 validates active user, expiry, idle renewal and absolute ceiling. Browser stores token in localStorage (`src/lib/api.ts:29`). seedAdmin at 40 runs at startup and has default development credential fallback; no login rate-limit or MFA implementation found.  <a id="e13"></a>
### E13 â€” `src/components/sales/sales-workspace.tsx:196`

handleCheckIn obtains GPS but falls back to no coordinates (214â€“227); salesApi.checkIn â†’ /api/salespeople/me/check-in (`server/app.mjs:82`) stores attendance, UTC business day and optional coordinates without range/type validation. watchPosition (310) posts pings every â‰¥30s â†’ /api/sales/location (`sales-routes.mjs:42`) checks active attendance. checkOut 321 â†’ /api/sales/attendance/check-out (36) writes check_out_at and optional ping, no attendance-state guard. Visit start/complete never compare distance/customer GPS.  <a id="e14"></a>
### E14 â€” `src/components/sales/sales-workspace.tsx:235`

openVisit/handleVisitSubmit â†’ salesApi.startVisit/completeVisit â†’ /api/visits/:id/start and /complete (`server/app.mjs:83â€“84`), scoped by user. visitSchema at 29 validates productId/outcome/value/nonempty nextFollowUp; transaction updates visits, replaces visit_products, inserts expected_orders and follow_ups. It does not reject repeated completion or persist visitTags from UI. Unplanned form (323) â†’ /api/sales/visits/unplanned (`sales-routes.mjs:56`) checks customer access but always business_date=today, regardless of scheduledAt.  <a id="e15"></a>
### E15 â€” `server/sales-routes.mjs:80`

POST /api/sales/activities inserts customer_activities after only activityType/subject and optional customer authorization. src/lib/api.ts:146 defines addActivity but repository search finds no component calling it. Existing detail components only display activities. No dedicated tele-sales app, call-result validation or mandatory daily activity enforcement found.  <a id="e16"></a>
### E16 â€” `src/components/admin/admin-customers.tsx:31`

Admin customer query/owner forms â†’ /api/admin/customers (server/admin.mjs:1319), /owner (1369), /owners/bulk (1381), /:id (1397) â†’ tally_customers/monthly_sales/invoices/payments/visits. Products component â†’ /products and /:id (1409/1422) â†’ product tables/invoice lines. SalesHub customer selector â†’ /api/sales/customers (sales-routes.mjs:65, returns first 100), /:id (70) uses canAccessCustomer (17) with wider sibling/manager predicates than tally.customers (`server/tally/connector.mjs:5`).  <a id="e17"></a>
### E17 â€” `src/components/sales/sales-workspace.tsx:350`

MediaRecorder builds optional audio blob â†’ salesFeaturesApi.uploadVoiceNote (`src/lib/api.ts:162`) â†’ /api/sales/visits/:id/voice-note (`server/sales-routes.mjs:147`), multer saves data/voice-notes and writes visits.voice_note_path. File is stored before ownership/update-result check; API returns path even if no row changed. uploadVoiceNote parses JSON without checking response.ok. No authenticated audio-read endpoint, transcript linkage, retention, durable object storage or mandatory recording gate found.  <a id="e18"></a>
### E18 â€” `server/stt.mjs:36`

VoiceMicButton (`src/components/common/voice-mic-button.tsx:21`) tries Web Speech (en-US) then MediaRecorder â†’ transcribeSpeech (`src/lib/api.ts:170`) â†’ POST /api/stt; mounted before any auth at app.mjs:23. multer memory upload max25MB; actual fetch to OpenAI /v1/audio/transcriptions using whisper-1 (52â€“61). No authenticate/role check, explicit translation API, language fields, provider timeout or transcript persistence. Follow-up dictation is at sales-workspace.tsx:154.  <a id="e19"></a>
### E19 â€” `server/app.mjs:31`

SalesWorkspace â†’ GET /api/salespeople/me/my-day â†’ buildSalesDay â†’ tally helpers, today visits, all follow_ups and SUM of all status='open' expected_orders at
51. It returns followUpsCreated=all followRows.length. SalesHub report form â†’ GET /api/sales/reports/activity (`sales-routes.mjs:136`) date-filters visits/orders/activities, inserts generated_reports on GET, and returns summary. Daily value in My Day is not date-filtered.  <a id="e20"></a>
### E20 â€” `server/sales-routes.mjs:129`

SalesHub alerts tab â†’ salesFeaturesApi.alerts â†’ /api/sales/alerts â†’ pending due-date queries in follow_ups/expected_orders/service_requests. Admin and RM alerts similarly query overdue rows. notifications table (`server/db.mjs:291`) exists but no notification insert/read/delivery route or scheduler usage found in server/src.  <a id="e21"></a>
### E21 â€” `src/components/sales/sales-hub.tsx:66`

Requests form offers sample, quotation, technical_support and complaint â†’ salesFeaturesApi.addRequest â†’ POST /api/sales/requests (`server/sales-routes.mjs:120`) â†’ service_requests; GET lists own requests and PATCH status scopes to user. Generic request validation is minimal and leadId ownership is not checked (security tracked separately).  <a id="e22"></a>
### E22 â€” `src/components/sales/lead-board.tsx:6`

LeadBoard mounted by SalesHub: eight STAGES/labels, create form, drag/drop and stage controls, leadDetail. salesFeaturesApi â†’ /api/sales/leads GET/POST/PATCH/DELETE, /:id/stage and /:id (`server/sales-routes.mjs:88â€“117`) â†’ leads table (`server/db.mjs:265`). user_id assigned to creator, allowed stage enum at 96; no transition-history table, explicit assignment endpoint or conversion report. next_action_date and expected_value stored; optimistic moves lack error rollback.  <a id="e23"></a>
### E23 â€” `server/connector-api.mjs:25`

AdminTally pairing â†’ /api/admin/tally/pairing-code (`server/admin.mjs:1531`); agent server endpoints /connectors/pair, /refresh, /heartbeat, /sync-job and /ingest/tally/chunks. connectorAuth hashes bearer tokens; ingestVoucherChunk 86, rebuildLiveSalesAggregates 188, normalizeTallySnapshot 215, finalize ~403. Persists connector/token/chunk/sync tables and invoice/customer/product/payment/purchase tables. No Windows agent source found. No HMAC/signature verification found despite architecture wording.  <a id="e24"></a>
### E24 â€” `scripts/import_psspldata.py:59`

import:data script clears snapshot tables with foreign keys disabled, reads named Excel workbooks into aggregates/masters/targets, creates account mappings and seeds field activity. Lines 343â€“405 create day-15 invoice records with arbitrary product splits; 407â€“463 allocate annual product sales evenly over 12 months to chosen customers. source_sync_id='excel-import'; ingest_session_id=NULL. scripts/import_excel_data.py is another workbook import; dummy/demo/sample seed scripts and data/crm-baseline.sqlite.gz also exist. Original workbooks, Tally instance and authorization records not supplied for reconciliation.  <a id="e25"></a>
### E25 â€” `server/admin.mjs:1136`

AdminReports (`src/components/admin/admin-reports.tsx:198`) â†’ adminApi.salesReport(from,to) â†’ /api/admin/reports/sales â†’ committed tally_invoices SUM/COUNT, line aggregates, owner/region joins, monthly returns/receipts. byCustomer/byProduct LIMIT100; summary/owner/month totals are uncapped. API accepts only from/to filters; UI group selector is not a filter. Product-trends endpoint at 973 compares ledger product/region periods and fallback historical aggregates. CRM customer/product searches are separate master filters.  <a id="e26"></a>
### E26 â€” `server/tally/connector.mjs:132`

tally.status reads current connector heartbeat, tally_available and last_sync_at; connected if heartbeat younger than three minutes. AdminTally and overview show state/lastSyncAt; GET /api/admin/tally (`server/admin.mjs:1472`) exposes missing mappings, duplicate GUIDs, line variances, stale runs and invoice coverage. Local reports read SQLite independently of connector online status.  <a id="e27"></a>
### E27 â€” `src/components/admin/admin-overview.tsx:41`

RevenueHero and quarterly charts consume charts.monthlySales from /overview; product/territory bars consume API aggregates. RM monthly target chart (`admin-rm-detail.tsx:81`) consumes monthlyTargetVsActual; admin-product-trends.tsx consumes productTrends API. Wiring confirmed; numerical provenance/period defects are tracked separately.  <a id="e28"></a>
### E28 â€” `src/components/admin/admin-reports.tsx:210`

downloadCsv quotes cells, downloadExcel produces HTML with .xls extension, window.print gives browser PDF; all use returned rows, not just client page, but API LIMIT100 still truncates. saveReport â†’ POST /api/admin/reports/history saves only summary/date/view; sendWhatsApp uses saved summary. RM PDF generation (`rm-report-pdf.tsx`) and two print routes read detail API and repeat capped dealer logic. No CSV formula neutralization, true XLSX generation or full CRM/audio export found. Export rendering was not exercised.  <a id="e29"></a>
### E29 â€” `src/components/admin/admin-ask-ai.tsx:46`

AskAiContent sends question/from/to through adminApi.askAi â†’ POST /api/admin/ask-ai (`server/admin.mjs:1307`), but backend uses buildContext(admin), ignores request dates and returns its own dates. SalesAskAi and RM endpoints call buildContext with scopes. ai-provider.mjs makes real Gemini/OpenAI requests with timeout/fallback/503; scripts/ai-provider.test.mjs covers mocked provider behavior only.  <a id="e30"></a>
### E30 â€” `server/ai-context.mjs:23`

buildContext topProducts and thrustProducts select all tally_products/lines without user/team predicates or staging exclusion. FY predicates are on LEFT JOIN tally_invoices, but SUM(l.amount) still includes unmatched old invoice lines. Synthetic execution reproduced exposure of another customer's 2020 amount in salesperson current-FY context. Context truncates JSON string at 2000 characters; scope and complete JSON grounding are not assured.  <a id="e31"></a>
### E31 â€” `server/app.mjs:102`

node-cron '0 17 * * *' calls sendEodSummary with no timezone option; server/whatsapp.mjs:52 aggregates global day visits/check-ins plus all open follow-ups/orders. sendWhatsAppText uses actual Graph API HTTP with 15s timeout, returns ok:false when unconfigured. Expected env variable is WHATSAPP_RECIPIENT_NUMBER; README example uses WHATSAPP_RECIPIENT_PHONE. No persistent job/delivery/retry/idempotency or template/session validation in source.  <a id="e32"></a>
### E32 â€” `server/app.mjs:88`

PATCH /api/follow-ups/:id/toggle and /:id UPDATE by id only; authenticated owner-a can update owner-b row (isolated actual-handler probe). Creation checks required values but not customer access. sales-routes.mjs:106 deletes activities/requests by lead_id before owner-scoped lead DELETE; activities/requests accept unchecked leadId; rm-routes.mjs:410 dormant-reason write lacks customer-scope check. STT and AI context gaps in E18/E30. Admin and RM router role guards are present.  <a id="e33"></a>
### E33 â€” `server/supabase-sync.mjs:24`

Replica connects with ssl.rejectUnauthorized=false, enumerates every SQLite table, creates PostgreSQL tables and upserts every row including users/sessions/tokens/location/audio paths, without reproducing constraints/RLS or deleting removed rows. Connector finalize spawns it after import. Actual cloud credentials, ACLs, disk encryption and tenant boundary unverified. server/app.mjs:18 reflects arbitrary CORS origin with credentials; deployment docs describe HTTPS hosts but current host enforcement not inspected.  <a id="e34"></a>
### E34 â€” `server/admin.mjs:465`

Admin middleware records successful POST/PATCH/DELETE responses to audit_logs and redacts password/token/pairingCode. AdminAudit component â†’ /api/admin/audit retrieves logs. Login is outside middleware; field operations and denied attempts excluded; downloadCsv/Excel are browser-side and create no export log. README claims broader audit coverage than these paths demonstrate.  <a id="e35"></a>
### E35 â€” `server/db.mjs:12`

Missing DB restores bundled gzip; then opens writable DatabaseSync, enables WAL, calls runMigrations, CREATE/ALTER/seed and PRAGMA optimize. server/migrations.mjs records baseline/applications. This is initialization, not recurring backup. database/migrations/README.md and deployment report note ephemeral deployment storage. Export-sqlite-baseline script actually writes baseline SQL schema; replica has no complete restore workflow or consistent snapshot guarantees.  <a id="e36"></a>
### E36 â€” `src/lib/use-admin-data.ts:15`

useAdminData retains cached data with errors/retry and uses shared attendance revision subscription for selected views. attendance-monitor.ts handles visibility, non-overlap, abort and retries; attendance-revision.mjs hashes persisted daily attendance. SalesWorkspace handles 401/general errors but no offline queue; refresh-data-button.tsx reloads entire page and can discard unsaved input. Client cache not keyed by authenticated principal or explicitly cleared by clearSession.  <a id="e37"></a>
### E37 â€” `README.md:1`

README, ARCHITECTURE and docs/superpowers plans/reports/specs describe architecture/development/release behavior. Searches found no separate September 1/8/26 meeting summaries, NDA-specific file, task-oriented training SOP or full user procedures. Technical descriptions are partial user guidance only; absence means 'not found in inspected repository', not that no external document exists. 

<a id="e38"></a>
### E38 — Phase 5 field-work implementation and synthetic verification

`server/field-activity.mjs` establishes Asia/Kolkata date handling, strict date-only validation, coordinate bounds/accuracy validation, check-in persistence and daily saved-activity aggregation. `server/app.mjs` applies guarded attendance/visit state transitions; `server/sales-routes.mjs` validates owner-scoped call logging and audio retrieval; RM/admin call aggregates include new incoming/outgoing records. `scripts/phase5-field-workflows.test.mjs` exercises India midnight rollover, repeat check-in/out, optional/no GPS, inaccurate coordinates, team customer authorization, call/follow-up records, daily totals and protected audio access on disposable SQLite data. It does not verify browser/device geolocation, an external speech provider, production audio retention, or live telephony.
Follow-up rows have a completed flag but no completion timestamp. Daily summaries therefore report current pending/overdue counts and do not classify prior completed follow-ups as completions for the selected day.
The owner-scoped sales alert endpoint exposes past planned/in-progress visits as scheduled items requiring status confirmation; it does not classify them as missed/no-show.

<a id="e39"></a>
### E39 — Phase 6 lead pipeline, reporting filters and export verification

`database/migrations/003_lead_stage_history.sql` adds an append-only lead stage history table. The migration was tested in isolation and is also present in the configured local database: the already-running Node watch process restarted after server files changed and applied migration 003 automatically. A read-only metadata check confirmed only the empty history table and index; no business rows were changed or backfilled. `server/sales-routes.mjs` scopes lead reads to the creator/assignee, RM direct reports, or admin, validates lead fields/stages, restricts assignment to admins and same-team RMs, writes stage actor/time/previous/new stage transactionally, and exposes scoped won/lost conversion counts. `src/components/sales/lead-board.tsx` offers assignment where the actor has multiple permitted assignees, displays history and conversion, and restores state after a failed stage update.

`server/admin.mjs` applies date/FY, customer, product, salesperson/RM team, territory, and dealer-type filters consistently to authoritative invoice aggregates on `/admin/reports/sales`; product/customer result truncation was removed. Saved report summaries persist the filters and recalculate on the backend. CSV/Excel exports use complete response aggregates and include source/period/total labels. `scripts/phase6-leads.test.mjs` verifies validation, team/denied access, assignment controls, eight stage values/history and conversion route. `scripts/phase6-reports.test.mjs` verifies 105-group completeness, filters, FY boundaries, reconciliation, saved filter context and admin-only report access on disposable SQLite data.

Limitations: filters are implemented on Admin Sales Reports, not every legacy dashboard or RM report. Existing print output remains paginated. Lead follow-up is the existing `next_action_date`; it does not create a linked follow-up reminder. There is no Won/Lost reason/closed date or assignment audit history. Business-approved transition rules (such as whether Won/Lost can reopen) were not found, so valid enum transitions remain permitted. Production migration rollout and browser acceptance were not performed.

An isolated end-to-end My Day request initially returned HTTP 500 because `server/tally/connector.mjs` referenced `netInvoiceLineAmount` without importing it. The missing import was fixed. `scripts/phase6-my-day.test.mjs` now verifies that the authenticated My Day route returns HTTP 200 with disposable synthetic SQLite data.

<a id="e40"></a>
### E40 — Phase 7 AI, WhatsApp automation, reminders and SOP verification

`server/report-snapshot.mjs` derives active-account scope, valid India reporting dates, signed committed invoice/line aggregates, current CRM metrics, sync state/age and conservative explicit RM target coverage. It reuses unchanged Phase 2 metrics and Phase 3/4 performance/management/visit functions. `server/ai-context.mjs` produces complete JSON; `server/ai-answer.mjs` validates provider-selected evidence IDs and renders server-owned facts/actions. All three authenticated AI routes use the shared handler and per-account limiter. `admin-ask-ai.tsx` date controls now affect backend context and handle January–March financial-year rollover.

`server/report-automation.mjs`, `server/whatsapp.mjs` and additive migration 004 implement disabled-by-default approved recipient/template schedules, India daily/prior-month timing, monthly restart catch-up, persistent unique occurrences, atomic claims, bounded explicit-rejection retries, ambiguous-outcome holds and HMAC-verified delivery-status callbacks. Early callback metadata is retained and later reconciled. Legacy global/free-text sending is blocked. Admin setup/history APIs enforce the existing role guard; opt-out disables schedules. New workflow audit records omit phone numbers and raw AI questions. Migration 004 has not been applied to the existing database.

`server/reminder-summary.mjs` and the existing sales/RM/admin alert APIs expose scoped in-app pending/due/overdue follow-ups, upcoming visits, past scheduled review items and RM attention. Sales Hub, RM Alerts and Admin Alerts render these summaries. Unverified salesperson target-shortfall displays remain unavailable. These reminders do not imply external message delivery.

`scripts/phase7-automation.test.mjs`: 19 passed on disposable synthetic SQLite/API fixtures and mocked transports, including all-role AI success/denial, cross-team prompt isolation, selected dates, source/credit-note rules, missing/stale/failed data, provider failure, scheduling/restart, recipient controls, independent-database overlap/deduplication, retry/recovery, crash holds, disabled transport, reminders/visits, calculation consistency, template bounds and forged/early/out-of-order callbacks. The expanded AI provider/attendance suites pass 12 tests, including actual AbortSignal timeout handling under a mocked timer/provider. Phase 1–6 suites pass 37 tests plus the separate My Day HTTP 200 smoke. TypeScript, 29 backend/test syntax checks and whitespace validation pass. See [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md) for limits and safety evidence.

The three existing training SOPs were updated with practical tasks, metric limits, exercises and sign-off fields. The operator runbook documents protected setup and delivery prerequisites. I01–I10 completion records document authorship/source review only; actual training and user acceptance are pending. G01–G09 retain partial/live-unverified qualifications. No arbitrary BI/causal inference, ambiguous target mapping, provider policy certification, real message, paid provider response, production migration, deployment or final UAT is claimed. Overall local acceptance is CONDITIONAL PASS.


<a id="e41"></a>
## E41 Phase 8 final UAT execution and reconciliation

Date: 18 October 2026 (Asia/Kolkata). Final acceptance: FAIL. The original 142 IDs were reviewed individually; classifications and findings are in [requirements.json](../uat/phase8/requirements.json), [full matrix](../uat/phase8/requirements-matrix.md) and both updated original matrix files. Current totals: 28 COMPLETED, 103 PARTIALLY COMPLETED, 5 NOT IMPLEMENTED, 1 BROKEN, 5 NOT VERIFIED; verified completion 19.72%.

Fresh execution: [results.json](../uat/phase8/results.json) contains per-command exit codes and test counts. P1 10, P2 6, P3 4, P4 8, P5 5, P6 leads 2, P6 reports 2, P7 19, AI transport 7, attendance 5 and P8 8 = 76 passing Node tests. Standalone compatible-schema My Day HTTP 200 and local TypeScript check also pass. Logs are linked in the [final report](./PSSPL_FINAL_UAT_REPORT.md#3-executed-verification-and-evidence).

New source traces: scripts/phase8-workflows.test.mjs -> scripts/phase8-fixture-server.mjs -> actual server/app.mjs auth/login/me/logout, check-in, visit start/complete and My Day routes; server/sales-routes.mjs calls, leads/history/conversion, protected voice upload/download; server/follow-up-routes.mjs owner-protected completion; server/stt.mjs authenticated multipart STT with a mocked provider; server/admin.mjs filtered net sales. Tests assert persisted visit status, one completed visit, one logged call, expected order 2500, created follow-ups, six lead history entries, other-owner denials, session revocation/expiry and net filtered sales 900 after a 100 credit note against a 1000 sale. Original synthetic audio bytes round-trip with team access and no-store; microphone/recognition is not verified.

Financial evidence: P2 endpoint fixtures assert 61 eligible invoice rows despite a 50-row detail window, net actual 5975, explicit matching target, 100% achievement/concentration, null unsupported customer-origin count, cross-team exclusion and attention/card MTD/FYTD parity. P6 reports exercise 105 groups and explicit date/FY/customer/product/RM-team/territory/dealer predicates. P3/P4 test concentration, dormancy/history and planned/past-scheduled semantics. P7 exercises target/freshness absence, source exclusion, signed returns and FY rollover. Real Tally data, ingestion interruption/replay and cancellation handling are not certified.

AI/automation evidence: P7 mocked provider success/denial for authenticated roles, scoped server facts, invalid provider evidence, errors, selected periods, scheduler cadence/restart, overlapping claims, recipient opt-out/inactive controls, duplicate prevention, safe retries, ambiguous holds, template bounds, reminders and signed/forged/early/out-of-order callbacks. No real external provider call or WhatsApp send occurred.

Security/recovery: P1 tests object/team denials, authenticated STT, product-context isolation, encrypted backup restore/integrity, tamper/overwrite rejection, configuration failure, startup refusal and rate limits. P8 adds wrong-key restore rejection and real login/logout/expiry/audio flow. Source review confirms replication TLS certificate validation is now enabled; deployed TLS/storage/monitoring are not verified. Production backup destination, scheduling/key escrow, RPO/RTO and audio recovery remain open.

Confirmed defect UAT-01: current server/db.mjs initialization omits operating_city/reg_code_1/reg_code_2 from salesperson_profiles. P8 verifies missing-column SQL and actual-app login HTTP 200 followed by My Day HTTP 500 without a fixture shim. The compatible fixture and older smoke intentionally add these three columns; their passing paths are qualified, not proof of clean-start readiness. C20 is BROKEN on this path. No existing CRM database was migrated or started.

Confirmed defect UAT-02: src/components/admin/admin-reports.tsx applyPreset builds local-midnight dates then uses toISOString().slice(0,10). P8 runs that source pattern with TZ=Asia/Kolkata: 1 October becomes 30 September. Explicit backend filters work; UI preset boundaries remain defective (F07 partial).

Browser evidence: cua.getState returned no apps/browsers and cua.getBrowser({id:"iab"}) returned Browser is not available: iab. Actual browser/mobile/GPS/microphone/export testing is NOT VERIFIED. [Manual checklist](../uat/phase8/browser-mobile-checklist.md) lists 20 cases. No screenshots or responsive/device PASS are claimed.

Documentation evidence: docs/training/PSSPL_RM_SE_SOP.md, PSSPL_RM_Manager_SOP.md and PSSPL_Admin_SOP.md were read in full. I01-I10 certify authored usage procedures, exercises and sign-off fields only; actual training/client acceptance remain pending. [Client checklist](./PSSPL_CLIENT_APPROVAL_CHECKLIST.md) lists 28 pending approval items, including meeting provenance, mapping/targets, thresholds, recording/language, formats, migration/recovery, integrations and final acceptance.

Safety: scripts/phase8-run-uat.mjs removes inherited real provider/replication credentials, defaults all DB access to a temporary synthetic database and preloads scripts/phase8-isolation.mjs to block non-loopback real networking. Full-app audio storage is inside its temporary cwd; STT provider responses are mocked. Hash comparison during the isolated verification window found zero changed existing files (241 inputs). A later final check found WAL/shared-memory changes and newly running normal development/watch backend processes, absent initially and not launched by Phase 8 tools. The main database, application source and configuration/credentials still matched; whole-session transactional database preservation cannot be certified and no business-row/migration state was queried. [preservation.json](../uat/phase8/preservation.json) records the concurrent differences and intended document changes. Phase 8 tools invoked no live data/credentials/.env mutation, existing-database migration, real provider, deployment or Git mutation. The independent normal processes were not stopped or used for testing. Phase 9 has not started.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
