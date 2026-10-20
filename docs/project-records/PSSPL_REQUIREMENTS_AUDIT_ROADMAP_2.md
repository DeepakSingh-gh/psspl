# PSSPL Requirements Audit — Roadmap (R09–R12) and Updates

Source: [PSSPL_REQUIREMENTS_AUDIT.md](./PSSPL_REQUIREMENTS_AUDIT.md).

<a id="r09"></a>
### R09 â€” Connector resilience, recoverability and deployment reliability

**Priority:** P0 backup/TLS/schema, P1 resilience. **Complexity:** High.   **Mapped incomplete requirements:** E15, E16, H05, H06, H07, H08, H09, H11.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Offline statuses, staged ingestion, gzip initialization, limited logs and full-table replica exist; durable recovery and full fresh schema are not established.
| Required changes | Create reviewed schema migrations for route-required fields/tables; preserve published vouchers while staging resync; atomic publication, corrected/deleted line handling and company/source isolation; correct token expiry; verified TLS; selective audited replication; encrypted consistent backups/retention/restore; expand audit trails and portability.
| Frontend files | admin-tally.tsx, admin-audit.tsx, reports/download/error/freshness components; deployment/operations docs.
| Backend files | server/db.mjs, migrations.mjs, connector-api.mjs, supabase-sync.mjs, auth.mjs, admin.mjs audit middleware; database/migrations and deployment scripts.
| Database changes | Versioned complete schema; separate staging/version identities or publication strategy; backup manifests and audit event coverage; avoid indiscriminate copying auth/session/connector secrets to replica.
| APIs | Connector append/finalize/retry/error contracts; diagnostics/status; authenticated portability/backup management only if needed; no public restore endpoint by default.
| Dependencies | R00 deployment/storage access; R01 permissions; R02 provenance decisions; recovery evidence before any real data-changing implementation.
| Testing | Future approved tests on synthetic temporary DB: fresh schema and upgraded schema, interrupted/replayed chunks, corrected/removed/cancelled voucher lines, multiple companies, published-read invariance, token expiry, SSL rejection, backup restore/checksums and deployment restart; do not run during this audit.
| Acceptance criteria | Fresh approved setup supports all routes without seeding client data; interrupted sync leaves last good data visible; restore demonstrably recovers latest agreed checkpoint; certificates validated; failed/denied/field/export events auditable. |  <a id="r10"></a>

This companion contains roadmap items R09–R12 and the audit implementation updates.

### R10 â€” Grounded Ask AI and honest performance intelligence

**Priority:** P2 after P0 access/metrics. **Complexity:** Medium.   **Mapped incomplete requirements:** G01, G04, G05.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Provider fallback/error implementation passes mocks; context is truncated/global and ignores selected dates; report-card Insights is deterministic.
| Required changes | Use canonical authorized metrics with requested scope/dates/source/as-of; provide complete structured context and missing-data behavior; distinguish rule-based observations from model output; add individual RM coaching only from validated data; surface provider outages.
| Frontend files | admin-ask-ai.tsx, sales-ask-ai.tsx, admin-rm-detail.tsx InsightPanel, ai-response-formatter.tsx.
| Backend files | server/ai-context.mjs, ai-provider.mjs, admin.mjs/sales-routes.mjs/rm-routes.mjs Ask AI endpoints.
| Database changes | No schema required for initial grounded queries; optional minimal request/usage audit with retention/redaction after policy review.
| APIs | Update /api/admin/ask-ai date/metric contract, /api/sales/ask-ai and /api/rm/ask-ai; proposed scoped RM coaching endpoint if requested.
| Dependencies | R01 context isolation; R02/R03/R08 validated metrics/filters; approved providers/data-sharing rules.
| Testing | Mocked context snapshot/authorization tests, invalid/truncated JSON prevention, date honoring, empty/stale data, insufficient context, provider timeout/fallback, model-output numeric fidelity and prompt-injection attempts in stored text.
| Acceptance criteria | AI never sees data outside requester scope; selected dates are honored; observations cite matching metric values/as-of; missing data prompts clarification rather than invented recommendations; deterministic advice labelled accurately. |  <a id="r11"></a>
### R11 â€” Durable scheduled reporting and WhatsApp delivery

**Priority:** P2. **Complexity:** Medium.   **Mapped incomplete requirements:** G06.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Cron and real sender exist; schedule uses server timezone, report content is global and no delivery persistence or retries.
| Required changes | Set explicit Asia/Kolkata schedule; approved role/recipient/report scope; align configuration names; durable job claim/dedup/retry/delivery tracking; provider-compliant templates/session handling verified during implementation; handle cold-start/missed runs.
| Frontend files | admin-reports.tsx delivery/history UI; optional scheduling settings/status UI.
| Backend files | server/app.mjs cron; server/whatsapp.mjs; admin.mjs send-whatsapp and report-history.
| Database changes | Scheduled report definition/execution/delivery records with idempotency key, attempt/error/status/provider ID; no credentials stored in client code.
| APIs | Update /reports/send-whatsapp; add authorized schedule and delivery-history endpoints if approved.
| Dependencies | R08 complete scoped reports; R01/R09 controls/reliability; R00 approved recipient, provider configuration and actual test scope.
| Testing | Mock fetch: success/unconfigured/error/timeout, duplicate scheduler processes, timezone, missed schedule/retry, recipient authorization, correct report scope; separately authorized real delivery test.
| Acceptance criteria | One scheduled report per intended period/recipient; truthful delivery states with audit trail; retries do not duplicate messages; 17:00 IST is explicit and externally verified. |  <a id="r12"></a>
### R12 â€” User guides, training SOP and operational handover

**Priority:** P2 after workflows stabilize. **Complexity:** Medium.   **Mapped incomplete requirements:** I01, I02, I03, I04, I05, I06, I07, I08, I09, I10.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Technical README/architecture/development notes exist; end-user training and metric definitions are missing.
| Required changes | Create role-specific procedures for login, check-in/out, visits/calls, voice/translation, pipeline, follow-ups, support, daily close, admin actions, filters/exports and report interpretation; explain offline/GPS/provider exceptions and data freshness; synthetic practice exercises and sign-off checklist.
| Frontend files | Reference final actual frontend screens; docs/training proposed location, README links; no UI redesign required merely for documentation.
| Backend files | Reference approved API/metric definitions and operational error behavior; architecture/operations docs updated to remove unsupported claims.
| Database changes | No database change.
| APIs | No API change solely for documentation.
| Dependencies | R01â€“R11 final behavior as applicable; client review of mandatory policies and metric glossary.
| Testing | Walkthroughs on synthetic data by RM/SE/admin; verify every instruction against actual available UI and permissions; accessibility/translation review if required.
| Acceptance criteria | All ten training requirements covered with reproducible steps and clear metric provenance; client training/acceptance evidence recorded without claiming sign-off before it occurs. |
## 14. Top ten critical development gaps  1. **Authoritative accounting provenance:** separate reconstructed Excel-derived invoices from actual vouchers and reconcile mappings. 2. **Financial consistency:** eliminate overlapping source addition, 100Ã— target-unit disagreement, fabricated target defaults and inconsistent periods. 3. **Complete dealer analysis:** move top-five/active/concentration calculations off the capped50-invoice display list. 4. **Dealer lifecycle accuracy:** replace estimated new customers and visit-based dormancy with dated customer/invoice evidence. 5. **RM SQL correctness:** fix date-first parameter binding, activity join multiplication and inconsistent RM/user/team scope. 6. **Record authorization and AI confidentiality:** close cross-user follow-up/lead-child/dormant-reason gaps and global AI context exposure. 7. **Reproducible schema and recoverable deployment:** formalize out-of-band schema, protect last-good sync data and prove backup restoration. 8. **Operational activity completeness:** actual call-entry workflow, mandatory logging policy, IST business dates, idempotent completion and truly daily order summaries. 9. **GPS/audio reliability:** verify physical visits with approved exceptions; protect STT and retain linked original audio/transcripts securely. 10. **Reporting and automation completion:** real dimension filters/full exports, accurate scoped AI, durable notifications/scheduled WhatsApp, and usable training SOP.
## 15. Recommended next development tasks and approval boundary
1. Review this audit, source/provenance findings and unavailable meeting evidence; confirm authoritative sales, units, financial periods, RM/team scope, dormancy and new-customer definitions (R00).
2. Approve an implementation scope that first addresses authorization/AI disclosure (R01) and backup/schema/publication safeguards (critical R09), before any real-data corrections.
3. Implement and reconcile canonical Tally/source/identity/target calculations (R02).
4. Complete one shared RM card dataset and its dashboard/print parity; validate the 19%/96%/two-dormant fixture (R03).
5. Connect reliable management action rules (R04).
6. Finish activities/GPS/day scope and voice workflow (R05/R06), then lead traceability (R07) and filters/exports/notifications (R08).
7. Finish remaining connector/recovery operations (R09); add grounded AI improvements (R10), durable WhatsApp scheduling (R11), and training/handover (R12).
8. Perform separately authorized synthetic/staging end-to-end, device, integration and recovery acceptance. Production validation must identify the exact deployed frontend/backend and data snapshot.  **At audit publication, implementation was not authorized.** Phase 1 was later approved and implemented on the branch recorded in section
17. Phase 2 and production deployment remain unstarted.
## 16. Phase 0 audit preservation and report-validation record
- All 172 existing hashed files matched their pre-test contents, including existing tracked/untracked application files, documentation, .env-family configuration, SQLite main/WAL/SHM files and bundled baseline. Only `PSSPL_REQUIREMENTS_AUDIT.md` was added.
- Existing git modifications/untracked files were present before this audit and were preserved; they are not audit implementation changes.
- At audit completion, matrix validation found 142 distinct IDs; 21 COMPLETED, 91 PARTIALLY COMPLETED, 13 NOT IMPLEMENTED, 12 BROKEN, 5 NOT VERIFIED; completion 14.79%.
- Evidence and roadmap anchors resolved; literal file references checked for existence; every incomplete row is mapped to a detailed roadmap package.
- TypeScript and 11 safe existing test assertions passed. Isolated defect probes and static assertions are separately described in section 12.
- At audit completion, no code, configuration, database or existing documentation was modified. No destructive tests, migrations, imports, seeds, deployments or external messages were run.
## 17. Phase 1 implementation update (17 October 2026)
- Branch created from the then-current `main`: `fix/psspl-phase1-security`. Existing uncommitted and untracked work was preserved.
- **H03 changed from BROKEN to PARTIALLY COMPLETED** based on new synthetic regression evidence: owner-scoped lead and follow-up mutations, safe lead-child handling, customer-linked operation checks, RM dormant-reason scope, customer-detail activity scope, and individual/RM-team AI product aggregates. Other rows remain unchanged unless new evidence was sufficient to support a status change. Current matrix: 21 COMPLETED, 98 PARTIALLY COMPLETED, 13 NOT IMPLEMENTED, 5 BROKEN, 5 NOT VERIFIED; completion remains 14.79%.
- Final Phase 1 validation: `npm run test:security` passed 9/9 tests with temporary synthetic data; `npx tsc --noEmit` passed; `node --check` passed on the changed backend runtime/backup/sync scripts; the existing AI-provider/attendance suite passed 11/11 assertions; `git diff --check` passed (Git emitted only existing LF-to-CRLF working-copy warnings). Coverage includes permitted and denied cross-user operations, STT authentication/rate limiting, AI scope, authenticated AES-256-GCM backup/restore, tamper rejection, overwrite refusal, and the production startup guard.
- Added an encrypted backup/restore CLI and operating procedure with 30-file retention, integrity checks, fail-closed destination/key requirements, and restore-to-new-path semantics. A durable mounted backup destination, separate key escrow, host scheduler, monitoring, and recovery drill still require deployment configuration; Render Free's ephemeral filesystem is not a valid backup destination. The software test does not establish production RPO/RTO or durability.
- No production database was opened, migrated, or modified. The normal backend was not started. The first failed test attempt restored the bundled baseline into its temporary test path; fixture setup then failed, and cleanup removed the scratch directory. Subsequent test runs set `CRM_DISABLE_BASELINE_RESTORE=true` and used synthetic fixtures only.
- No `.env` or production credential was changed. Production startup now refuses implicit baseline restoration and refuses startup schema changes against an existing database unless the corresponding explicit deployment flags are supplied. Production migration execution was not run.
- Backup and restore tooling is implemented, but no production destination, encryption key, scheduler, alerting, key escrow or RPO/RTO has been configured. Supabase synchronization was not run; its table allowlist and TLS settings are source-reviewed only.
- Remaining limits: no real provider calls, deployed CORS/TLS verification, full route-by-route role review, protected durable audio storage, browser/device verification, backup scheduling, or production restore drill. Phase 2 Tally/RM report work was not started.
## 18. Phase 2 implementation update (17 October 2026)
- Branch `fix/psspl-phase2-tally-accuracy` was created from `fix/psspl-phase1-security`, preserving the existing working tree.
- B09, B10, B11 and B13 changed from BROKEN to PARTIALLY COMPLETED; the RM detail now uses full eligible invoice aggregates for top-five dealers, active count, dormancy and revenue concentration. B09/B10/B11/B13 changes are supported by `npm run test:phase2` synthetic fixtures, not live-accounting validation.
- G02 and G09 changed from BROKEN to PARTIALLY COMPLETED based on existing Phase 1 owner/team AI-scope tests and Phase 2 authoritative-source context queries. Broader AI answer grounding and complete endpoint/deployment verification remain open.
- Phase 2 regression outcome: `npm run test:phase2` 5/5 suites; `npm run test:security` 10/10; AI-provider/attendance 11/11; `npx tsc --noEmit` passed; changed backend syntax checks passed. No production database, credentials, or migrations were used. Details and limitations are in `PSSPL_PHASE2_VERIFICATION.md`.
- Remaining accounting decisions are not assumed: cancellation and adjustment semantics, cross-company voucher identity, durable customer mapping/ownership history, salesperson target units, non-Excel duplicate source inventory, and production freshness/reconciliation are unverified. Code-level acceptance is conditional; deployment and Phase 3 readiness are not certified.

## Phase 7 reconciliation - 17 October 2026

The findings and roadmap above retain their original review/planning context. For current AI, automation and SOP implementation, use [E40](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e40), [matrix part 2](./PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md) and [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md). Role-scoped complete AI context, selected dates, server-rendered evidence, durable recipient-specific schedules/retries/callbacks, in-app reminders and the three SOPs are implemented and covered by synthetic/mocked tests. These replace the earlier missing-implementation descriptions within that scope.

Broader BI/alias parity, approved recipient lists/consent/templates/schedules, supported provider configuration, live delivery, controlled migration/backup rollout, browser acceptance and delivered training remain open. SOP document completion is not training sign-off. Baseline completion counts were not recalculated; production readiness and final UAT are not inferred.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
