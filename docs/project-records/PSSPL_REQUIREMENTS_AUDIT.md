# PSSPL Requirements Audit

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

**Current reconciliation:** Phase 8, 18 October 2026 (Asia/Kolkata).  
**Final UAT acceptance: FAIL.** Local verification deliverables are complete; production readiness is not accepted.

The current 142-row audit is reconciled against fresh isolated execution, source review and acceptance limits. See [final UAT report](./PSSPL_FINAL_UAT_REPORT.md), [client approval checklist](./PSSPL_CLIENT_APPROVAL_CHECKLIST.md) and [E41](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e41). Both original matrix files have been updated without changing requirement IDs or wording.

| Current status | Requirements |
| --- | ---: |
| COMPLETED | 28 |
| PARTIALLY COMPLETED | 103 |
| NOT IMPLEMENTED | 5 |
| BROKEN | 1 |
| NOT VERIFIED | 5 |
| **Original baseline** | **142** |

**Current verified completion = 28 / 142 x 100 = 19.72%.** The lower count than the intermediate 46/142 labels reflects stricter acceptance evidence, including browser/device/provider limits, rather than a claim of code regression. Completed rows cover narrow API persistence/stage behavior or authored SOP content; unexecuted user-facing journeys remain partial.

All 76 automated tests pass, plus the isolated compatible-schema My Day smoke and TypeScript check. P8 also confirms UAT-01: fresh initialized database login succeeds but My Day returns HTTP 500 due to missing profile columns. UAT-02 reproduces the India-time date-preset shift. Expected-defect tests passing does not resolve those failures.

Missing: B12, C05, C08, C17, C19. Broken: C20 on the fresh-schema path. Unverified: E03, G07, H13-H15. Actual browser/mobile acceptance was unavailable; [20 manual cases](../uat/phase8/browser-mobile-checklist.md) remain NOT VERIFIED. Live Tally/AI/STT/WhatsApp and production configuration are not accepted. Independent September meeting records and client sign-off remain outstanding.

The baseline's STT unauthenticated endpoint, disabled replication TLS validation, target double-counting and fabricated new-customer descriptions are historical: current STT is authenticated; replication source validates certificates; shared net Tally calculations pass synthetic tests; the unsupported new-customer metric is null. Remaining source/data/acceptance limits are recorded per row in the current matrices.

Phase 8 tools invoked no existing database migration, normal startup, production-data/.env/credential change, real message, paid provider call, deployment or Git mutation. Isolated tests preserved all 241 existing inputs during execution. A later comparison detected WAL/shared-memory changes and an independently started normal development/watch backend; whole-session database preservation is therefore not certified. See the final report and preservation artifact. Application code/configuration remain preserved, changes are local and uncommitted, and Phase 9 requires the user's explicit approval.

## Historical baseline and prior phase evidence

The material below preserves the original audit and phase addenda for traceability. Its dates, architecture descriptions, defect claims, counts and percentage are historical observations; they do not override the current Phase 8 summary, matrices or E41. In particular, the earlier 21/142 and 14.79% values are the original audit baseline, not current completion.

﻿# PSSPL Requirements Audit

**Audit date:** 17 October 2026 (Asia/Kolkata)  
**Scope:** Baseline requirements audit with Phase 1 and Phase 5 implementation evidence addenda.  
**Source revision:** `87eae1ec68bccb8b11e2950bafecc8ccc81da508`, plus the existing local modified/untracked working files.  
**Artifact:** Audit matrix and roadmap; Phase 1 and Phase 5 requirement statuses changed only where implementation and synthetic test evidence support the change. The original aggregate completion totals have not been recalculated.

## 1. Executive summary

The CRM has substantial working source structure: authenticated portals, SQLite persistence, an admin dashboard, RM detail/report pages, customer/product masters, field visit and attendance workflows, an eight-stage lead board, reports, connector ingestion, speech transcription and AI/WhatsApp integrations. It is **not sufficiently evidenced as a complete, accurate, secure implementation of the client requirements**.

The primary gap is trustworthy management reporting, rather than absence of dashboard screens. Team sales can add historical product aggregates to invoices for the same period; target units differ by a factor of 100 between routes; admin dealer analysis uses only 50 invoice rows; new-customer figures are estimated; admin dormancy is visit-based; RM follow-up/pipeline queries bind parameters in the wrong order. The workbook importer reconstructs invoices and product allocations that must not be represented as actual Tally vouchers. Cross-user follow-up mutation and global AI product context exposure were reproduced using isolated memory-only execution.

### Completion accounting

| Status | Requirements |
| --- | ---: |
| COMPLETED | 21 |
| PARTIALLY COMPLETED | 92 |
| NOT IMPLEMENTED | 13 |
| BROKEN | 11 |
| NOT VERIFIED | 5 |
| **Total audited** | **142** |

**Verified Completion Percentage = (21 / 142) Ãƒâ€” 100 = 14.79%.**

Counting basis: 133 original checkbox requirements, eight individually listed pipeline stages, and one additional explicit NDA-documentation check = 142. Requirements repeated across modules remain separate because the prompt explicitly requests module-level traceability; this is not a count of 142 unique software capabilities. The 19% / 96% / two inactive dealers example is an acceptance scenario, not an additional requirement or actual client data.

**Meaning of verified:** COMPLETED means the specified implementation was traced through its source UI/API/persistence or calculation/output with sufficient evidence for that narrowly stated requirement. It does **not** certify production deployment, browser/device operation or client data accuracy. Partial implementations and live integrations not exercised are not counted as completed. For example, a wired chart or name link can be complete while the underlying financial calculation is broken under another requirement.

### Evidence limits

- The provided attachment is the available business requirements source. Separate September 1, September 8 and September 26 meeting summaries were not supplied or found in the inspected project. Individual meeting provenance, decisions not included in the attachment and client acceptance remain **NOT VERIFIED**; there is no claim that the original meeting record was independently validated.
- Local source is the technical authority. Existing documentation is cross-checked against code, not treated as proof of functionality.
- No normal application startup, live HTTP session, browser/device workflow, paid AI/STT request, WhatsApp message, connector import, Supabase sync, deployment, migration or seed was run.
- An immutable, read-only inspection of the SQLite **main file** intentionally excluded the existing WAL. Its aggregate findings demonstrate historical persisted content only, not a current transactional/live snapshot.
- Existing local edits were preserved. Hashes of 172 existing tracked/unignored files plus database/configuration files were captured before tests/report writing for a final preservation comparison. No secret values, password hashes, tokens or customer identity rows are included here.

## 2. Existing architecture

### Repository inventory and entrypoints

The inspected application inventory includes 82 files under `src`, 18 under `server`, 39 under `scripts`, two under `database`, eight under `docs`, and two under `.superpowers`, plus root configuration/documentation. Dependency and generated directories were excluded from application-source conclusions.

| Layer | Actual implementation and connections |
| --- | --- |
| Frontend | Next.js 15.5 / React 19 / TypeScript App Router, CSS, client-side components. Admin pages mount the shared AdminShell; RM and salesperson login land on /sales/my-day. /rm redirects there, while legacy RM/team/report/customer/product/alerts and print routes remain. See [E01](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e01), [E10](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e10), [E12](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e12). |
| API client | `src/lib/api.ts` uses /api in development and NEXT_PUBLIC_API_URL in production, attaches bearer token from localStorage, checks JSON response status except the audio-upload helper. Development Next rewrites proxy to Express. |
| Backend | Node Ã¢â€°Â¥22, Express 5 in `server/app.mjs`; mounts connector/STT/sales/RM/admin routers, Zod on selected endpoints, compression, CORS, error handler, node-cron. `dev-runner.mjs` starts Next and this backend. |
| Alternative entrypoints | `server/index.mjs` is an older in-memory/mock API with static visit/sales values; package start scripts use app.mjs instead. Root `server.mjs` serves a dist directory, not the normal Express CRM API. Mock code is not counted as the implementation of active routes. |
| Database | Node native SQLite DatabaseSync, WAL, foreign keys, synchronous SQL. `server/db.mjs` restores bundled baseline if absent, runs migrations and runtime CREATE/ALTER/seed statements. `database/migrations/001_initial_schema.sql` is only a core baseline. It is not equivalent to the schema present in the seeded local DB. |
| Auth and scope | users roles admin/rm/salesperson; salesperson_profiles manager_user_id; scrypt passwords; hashed random session tokens with idle/absolute expiry. Admin and legacy RM routers require roles. Other authenticated routes have uneven record-level authorization. |
| Tally | Local tables are served by `server/tally/connector.mjs`; it is a SQLite query adapter, not a direct connection to Tally. `connector-api.mjs` receives an external agent's pairing, heartbeat and chunked XML. Workbook scripts also populate tables and create synthetic invoices. No Windows agent implementation was located. |
| Reporting | SQL calculations concentrated in `server/admin.mjs` and `rm-routes.mjs`; React also computes dealer metrics. Includes monthly/product/person/region/customer views, detail expansions, CSV/HTML-as-XLS/print/PDF and saved summary history. No single canonical metric layer. |
| AI and speech | `ai-context.mjs` builds SQL-derived context; `ai-provider.mjs` calls Gemini/OpenAI. Admin Ã¢â‚¬Å“AI InsightsÃ¢â‚¬Â and Manager Action Plan are deterministic frontend rules. `stt.mjs` calls Whisper; VoiceMicButton first tries browser Web Speech. |
| WhatsApp / automation | `whatsapp.mjs` sends Graph API text and constructs global EOD summary; app.mjs cron invokes it. Optional Supabase script is spawned after connector finalization. |
| Mobile / GPS | Responsive browser application using geolocation/watchPosition and MediaRecorder. No native Android/iOS/React Native/Flutter project, service-worker implementation, offline queue or verified background tracking was found. Ã¢â‚¬Å“Mobile appÃ¢â‚¬Â requirements are assessed against this web implementation. |
| Docs / operations | README, architecture, development plans/specs/reports, migrations README. Historical release claims distinguish published frontend from pending local/backend work; current deployment was not queried. No training SOP or NDA evidence was located. |

### Schema and relationships

- **Identity:** users Ã¢â€ â€™ salesperson_profiles; profiles.manager_user_id Ã¢â€ â€™ users; sessions Ã¢â€ â€™ users.
- **Field work:** attendance Ã¢â€ â€™ users (unique user/business_date); visits Ã¢â€ â€™ users; visit_products Ã¢â€ â€™ visits; expected_orders Ã¢â€ â€™ visits/users; follow_ups Ã¢â€ â€™ users and optional visit. Completion transaction writes visits, products, expected orders and follow-ups.
- **Pipeline:** leads Ã¢â€ â€™ users, stage/value/next_action_date; customer_activities Ã¢â€ â€™ users and optional lead; service_requests Ã¢â€ â€™ users and optional lead/product/customer.
- **Accounting:** tally_customers (owner_user_id plus textual rm_name), tally_products; tally_invoices Ã¢â€ â€™ customer IDs; tally_invoice_lines Ã¢â€ â€™ invoice/product; monthly customer/product totals; RM product history and targets; receipts and purchase tables.
- **Connector:** pairing codes Ã¢â€ â€™ connector registration Ã¢â€ â€™ access/refresh tokens; sync runs and chunk sessions/parts; ingest_session_id marks staged accounting rows.
- **Operations:** location_pings, generated_reports, notifications, audit_logs, thrust_products.
- **Out-of-band seeded schema:** dormant_reasons is created by `server/migrate_dormant.mjs`; weekly/history tables and operating/registration profile columns by `scripts/seed_anil_jena_realtime.mjs:13Ã¢â‚¬â€œ37`. These are absent from both core initial SQL and ordinary db.mjs setup. Current routes refer to them.
- Customer-origin dates, effective-dated RM ownership and lead stage history are absent from inspected core schema. Some logical links are plain TEXT without foreign-key enforcement. Table existence alone is not completion evidence.

### Important architecture contradictions

1. Architecture documentation describes connector HMAC; inspected code uses bearer tokens and hashing, with no request-signature/HMAC verification.
2. README claims login/password/export audit coverage; only successful admin mutations pass the inspected audit middleware.
3. Documentation and coverage flags call reports automated/real-time; this does not prove actual voucher provenance, reliable calculations, scheduling, or deployment.
4. Fresh source initialization cannot reproduce all seeded schema required by current routes. Do not run seeds as an audit workaround.
5. Baseline restoration is initialization, not recovery of live changes; asynchronous full-table replication is not a tested backup/restore system.


## Detailed audit sections

- [Requirements completion matrix](./PSSPL_REQUIREMENTS_AUDIT_MATRIX.md)
- [Evidence register and end-to-end traces](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md)
- [Completion findings, risks, and validation](./PSSPL_REQUIREMENTS_AUDIT_FINDINGS.md)
- [Prioritized roadmap, R00â€“R08](./PSSPL_REQUIREMENTS_AUDIT_ROADMAP_1.md)
- [Prioritized roadmap, R09â€“R12 and implementation updates](./PSSPL_REQUIREMENTS_AUDIT_ROADMAP_2.md)
- [Phase 4 management dashboard implementation and verification](./PSSPL_PHASE4_VERIFICATION.md) â€” final completion addendum with synthetic endpoint and calculation evidence; baseline requirement totals are unchanged pending broader audit reconciliation.

### Phase 5 status addendum

The completion matrix now reflects code and isolated synthetic evidence for daily attendance state, India business dates, saved visit transitions, call entry/history, expected-order day totals and date validation. GPS remains partial because the user may deny location and no business-approved accuracy threshold or geofence exists. Audio remains partial because files are local to the server and production retention/device behavior are unverified. Telephony verification, mandatory end-of-day completion, and English translation remain unimplemented or outside the verified evidence. See [E38](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e38) and [PSSPL_PHASE5_VERIFICATION.md](./PSSPL_PHASE5_VERIFICATION.md). The original aggregate completion percentage is retained from the baseline audit and must not be read as recalculated after this addendum.

### Phase 6 status addendum

Synthetic evidence supports updates to the lead assignment, stage history, stage labels and conversion requirements (D02, D04, D05, D09, DS01, DS02, DS06). Evidence E39 traces the new API/UI, additive migration and disposable regression tests. Admin Sales Reports now supports backend date/FY, customer, product, RM/salesperson, territory and dealer filters; complete customer/product aggregates and filtered CSV/Excel data were verified over 105 synthetic groups. Saved report summaries retain filters. Other legacy dashboard/RM report filters and unpaginated print/PDF remain incomplete; lead closure reasons, historical stage backfill and linked follow-up reminders are not inferred. The original aggregate audit completion percentage has not been recalculated. No production migration, data change, deployment or external service call was performed. See [PSSPL_PHASE6_VERIFICATION.md](./PSSPL_PHASE6_VERIFICATION.md) and [E39](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e39).

### Phase 7 status addendum - 17 October 2026

[PSSPL_PHASE7_VERIFICATION.md](./PSSPL_PHASE7_VERIFICATION.md) and [E40](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e40) document scoped AI evidence selection, selected-period grounding, source/freshness limitations, protected per-recipient WhatsApp scheduling, durable duplicate prevention/retry/callback handling, in-app reminders and updated training SOPs. Existing Phase 2 financial rules and Phase 3/4 review functions are reused. SOP requirements now reflect authored/source-reviewed documentation only; delivery of training and sign-off remain pending. AI/automation remain partial where broader BI, mapping, business approval or live integration evidence is missing. WhatsApp live delivery remains NOT VERIFIED. No existing database migration, deployment, real message or paid provider call was performed. Baseline completion totals/percentage above are historical and were not recalculated. Phase 7 is a CONDITIONAL PASS for local implementation, not production readiness or authorization to start final UAT.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
