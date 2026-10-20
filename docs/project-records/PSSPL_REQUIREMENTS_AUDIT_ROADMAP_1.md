# PSSPL Requirements Audit — Roadmap (R00–R08)

Source: [PSSPL_REQUIREMENTS_AUDIT.md](./PSSPL_REQUIREMENTS_AUDIT.md).

This companion contains roadmap items R00–R08. Remaining roadmap items and audit updates are in ROADMAP_2.

## 13. Prioritized implementation roadmap  This section is a proposal, **not implementation performed or permission to start**. Every incomplete matrix row maps to one work package below; additional dependent work is named explicitly. No delivery dates are invented. A future schema or data correction requires a reviewed migration/provenance strategy and recovery proof before touching real data.  <a id="r00"></a>
### R00 â€” Evidence closure and isolated acceptance baseline

**Priority:** P0 audit prerequisite. **Complexity:** High.   **Mapped incomplete requirements:** E03, G07, H13, H14, H15.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Live connector/WhatsApp, client-data permissions, isolation applicability, NDA and original meeting provenance lack independent evidence.
| Required changes | Obtain/reconcile the three dated meeting summaries and approved metric definitions; verify live agent/version/company mapping and deployment revisions read-only; define synthetic acceptance datasets and explicitly authorized integration validation. Review NDA evidence with responsible client/owner without asserting legal compliance.
| Frontend files | README.md, ARCHITECTURE.md, existing reporting/connector/AI UIs; no app edits until approved.
| Backend files | server/connector-api.mjs, server/tally/connector.mjs, server/whatsapp.mjs, deployment documentation.
| Database changes | No schema/data change for evidence collection. Validate source/live schemas using read-only tools; do not start migration-capable app to inspect production.
| APIs | No endpoint creation required initially; read-only status and deployment metadata only. Real messaging/provider tests require a separately defined recipient/test scope.
| Dependencies | Original meeting records, deployment access, client data-use policy, approved external-integration test scope.
| Testing | Static contract review; isolated fixtures covering aliases, no-target/no-data, 51+ invoices, returns, inactive and new dealers; distinguish current data from main-file historical snapshot.
| Acceptance criteria | Each unknown has supporting evidence or remains explicitly NOT VERIFIED; no real data/messages changed; report scope agreed. |  <a id="r01"></a>
### R01 â€” Authorization and confidential-data boundaries

**Priority:** P0. **Complexity:** High.   **Mapped incomplete requirements:** C09, C14, G02, G09, H01, H02, H03, H04, H12.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Role/session checks exist, but record mutations, lead children, STT and AI product context bypass intended scope.
| Required changes | Centralize user/team/customer/lead scope; require authorized object existence before mutations/uploads; scope all AI queries; protect and limit STT; validate customer/lead relationships and input enums; harden seed credential behavior, CORS and session/cache handling.
| Frontend files | src/lib/api.ts; admin-customers.tsx, sales-workspace.tsx, lead-board.tsx, sales/admin Ask AI; src/lib/use-admin-data.ts.
| Backend files | server/auth.mjs, app.mjs, sales-routes.mjs, rm-routes.mjs, stt.mjs, ai-context.mjs, admin.mjs.
| Database changes | Usually no core schema needed for scope fixes; assess indexes, audited denied events and optional usage records. Do not retrofit tenancy until applicability is decided.
| APIs | Update PATCH /api/follow-ups/:id(/toggle), follow-up create, lead DELETE/activity/request endpoints, dormant-reason POST, audio upload/read, /api/stt and all /ask-ai paths.
| Dependencies | R00 access matrix; explicit owner/team policy; R02 mapping decisions.
| Testing | Cross-user/role negative tests for every mutation/read; child deletions are transactional; invalid relation IDs rejected; upload rejected before disk write; AI context contains only authorized committed date-filtered records; mock STT rate/failure tests.
| Acceptance criteria | Owner A cannot read/change B's confidential objects except authorized team cases; AI cannot expose other scopes; unauthenticated STT fails before upload/provider expenditure; logout clears confidential caches. |  <a id="r02"></a>
### R02 â€” Authoritative Tally provenance, identity and canonical metrics

**Priority:** P0. **Complexity:** High.   **Mapped incomplete requirements:** A02, A03, A06, A08, B03, E01, E02, E04, E05, E06, E07, E08, E09, E14, E18, E19.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Connector plus aggregate workbook imports coexist; workbook script reconstructs invoices; team adds both historical and invoice totals; owner/alias routes disagree; units differ.
| Required changes | Define authoritative voucher vs aggregate-only provenance; remove reconstructed rows from transaction claims through a separately reviewed data plan; establish source precedence and cross-source/company master mapping; canonical/effective-dated RM attribution; standardize monetary units and reporting dates; prohibit fabricated target defaults.
| Frontend files | admin-team.tsx, admin-overview.tsx, admin-tally.tsx, admin-management-reports.tsx, RM/sales performance components; src/types/admin.ts, src/types/sales.ts and format helpers.
| Backend files | server/admin.mjs buildTeam; tally/connector.mjs; rm-directory.mjs; connector-api.mjs; rm-routes.mjs; importer scripts.
| Database changes | Likely provenance/source-kind and stable master/company mapping; target unit contract; ownership history only after business rules. Plan migration and reconciliation of existing records without blind deletion or relabeling synthetic transactions as genuine.
| APIs | Update /api/admin/overview, /team, /team/:id, /reports/sales, /management-reports, /api/rm/* reporting and /salespeople/me/my-day; expose missing mappings/source/as-of consistently.
| Dependencies | R00 definitions and actual Tally comparison data; R01 scope; R09 recovery before any data correction.
| Testing | Fixtures for overlapping history/invoices, name changes/similar distinct people, reassignment, multiple companies, raw targets below/above10, credit notes/cancellations and aggregate-only years.
| Acceptance criteria | Same scope returns identical rupee actual/target across pages; no double counting; synthetic/aggregate-derived history is explicitly separated; genuine invoices reconcile to approved Tally totals; missing targets stay unavailable. |  <a id="r03"></a>
### R03 â€” One reliable RM report-card dataset

**Priority:** P0. **Complexity:** High.   **Mapped incomplete requirements:** B01, B02, B04, B05, B07, B08, B09, B10, B11, B12, B13, B14, B15.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Rich admin/legacy cards exist but dealer metrics use50 rows, new count is estimated, dormancy is visit-based, SQL bindings/periods differ and print contains hardcoded values.
| Required changes | Build backend full-population metrics; repair bind order and aggregate fan-out; use customer IDs; calculate onboarding/new/dealer health from agreed dates/history; complete calls/YTD/trends/zero-month handling; paginate detail independently; remove hardcoded financial print values; reuse same dataset for screen/PDF.
| Frontend files | admin-rm-detail.tsx, rm-report-pdf.tsx, src/components/rm/rm-report-card.tsx, src/app/admin/team/[id]/print/page.tsx, src/app/rm-report/[id]/page.tsx, src/app/rm/print-report/page.tsx, src/types/admin.ts and src/lib/api.ts.
| Backend files | server/admin.mjs /team/:id; server/rm-routes.mjs /report-card and /print-report; shared metric layer to be introduced only during approved implementation.
| Database changes | Customer onboarding/origin date and provenance if unavailable; no invented backfill from import time. Add only justified indexes/metadata; R02 ownership/target/source schema first.
| APIs | Extend existing RM detail/report response with full totals, dealer health, concentration, calls and data-quality metadata; add paginated child lists as necessary; align print endpoints.
| Dependencies | R02 canonical calculations; R01 authorization; agreed dormancy/new-customer definitions; R05 call/activity records.
| Testing | 19%/96%/two-dormant fixture, >50 invoices, omitted older high-value dealers, duplicate visit rows, same-named customers, zero months, no invoices, returns, missing dates/targets, selected vs effective period and PDF parity.
| Acceptance criteria | Dashboard/card/print match for same RM and dates; full-population counts independent of page size; dormancy derives from invoices; no estimated new-customer count; missing historical evidence is disclosed. |  <a id="r04"></a>
### R04 â€” Reliable management actions and dealer remediation

**Priority:** P0. **Complexity:** Medium.   **Mapped incomplete requirements:** A09, B16, B17, F18.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Attention cards, deterministic Insights and Manager Action Plan exist; inputs are unreliable and actions are not tracked.
| Required changes | Generate explainable rules from canonical metrics; prioritize RM shortfall/dependency/dormancy/follow-ups; deduplicate dealer evidence; distinguish missing data from healthy performance; link actionable records and implement accountable owner/due/status if approved.
| Frontend files | admin-overview.tsx, admin-team.tsx, admin-alerts.tsx, admin-rm-detail.tsx, rm-report-pdf.tsx.
| Backend files | server/admin.mjs alerts/overview/RM detail; shared rule evaluation proposed.
| Database changes | Optional management_actions with owner, source metric/scope, due date and status if workflow tracking is approved; simple derived recommendations need no persisted table.
| APIs | Extend /api/admin/alerts and /team/:id; proposed action status/assignment endpoints only if persistence is selected.
| Dependencies | R02/R03 trusted metrics; client-approved thresholds and R01 permission rules.
| Testing | Threshold boundaries, missing-target/data cases, duplicate dealers, zero/negative revenue, stale ledger, deterministic output without provider and drill-down scope retention.
| Acceptance criteria | 19%/96%/two-dormant scenario gives specific supported actions; healthy message never inferred merely from absent data; every alert opens matching evidence. |  <a id="r05"></a>
### R05 â€” Field work, business-day and mandatory activity completion

**Priority:** P1 with P0 date/access dependencies. **Complexity:** High.   **Mapped incomplete requirements:** A04, A05, A12, B06, C02, C03, C04, C05, C06, C07, C08, C13, C20, C21, C22, H10.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Browser attendance/tracking, visits, requests and follow-ups persist; calls have no entry form, GPS is optional, daily counters and activity dates are inconsistent.
| Required changes | Add real call-log workflow and agreed mandatory logging policy; centralize Asia/Kolkata business date; validate coordinates/state transitions/scheduled day; implement physical-visit verification with documented exceptions; make visit completion idempotent; persist tags; distinguish plans, calls, completed work and daily order values; robust offline/error behavior.
| Frontend files | sales-workspace.tsx, sales-hub.tsx, sales-sidebar.tsx, admin-activity.tsx, salesperson-map.tsx, src/lib/api.ts, src/types/sales.ts.
| Backend files | server/app.mjs visit/attendance/buildSalesDay; sales-routes.mjs activities/location/requests; admin.mjs and rm-routes.mjs activity summaries; attendance-revision.mjs.
| Database changes | Potential customer coordinates, visit verification accuracy/distance/status/reason, completed-call metadata, activity idempotency and original plan evidence; offline queue only after storage/security policy.
| APIs | Update check-in/out, visit create/start/complete, /sales/activities, My Day, activity/alerts; provide authorized coordinates/verification contract and call UI data.
| Dependencies | R01 permissions; approved mandatory activity/GPS-exception policies; R02 dates/scope; device capability tests.
| Testing | IST midnight, future/past scheduled visits, coordinate range/accuracy, denied/unsupported GPS, checkout without check-in, repeated completion, failed-network retry, call persistence, daily-vs-all-open sums, duplicate joins and team scope.
| Acceptance criteria | Day totals contain only intended activities; calls survive reload and appear in admin/RM reports; required activity cannot be bypassed by direct API calls; GPS exceptions are explicit; retried completion creates one order/follow-up set. |  <a id="r06"></a>
### R06 â€” Voice recording, transcription and English translation

**Priority:** P1. **Complexity:** High.   **Mapped incomplete requirements:** C15, C16, C17, C18, C19, G03.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Browser mic, optional local audio upload and Whisper transcription exist as separate paths; no durable/protected retrieval or mandatory transcript linkage.
| Required changes | Validate browser formats/capabilities; authenticate before uploads/provider; connect original audio and transcription to interaction; explicitly implement English translation where required; enforce approved mandatory rules server-side; add durable protected storage, retrieval, consent/retention and honest error states.
| Frontend files | sales-workspace.tsx, common/voice-mic-button.tsx, sales-hub.tsx and src/lib/api.ts upload/transcribe helpers.
| Backend files | server/stt.mjs, sales-routes.mjs audio route, app.mjs visit schema; proposed media storage/service boundary.
| Database changes | Audio metadata with activity/visit owner, content type, size, checksum/storage key, transcript/original language/translation state and retention metadata; storage decision before migration.
| APIs | Protect /api/stt; update voice-note upload and completion contract; add authorized audio retrieval and transcription/translation status endpoint as needed.
| Dependencies | R01 access/limits; R05 activity model; provider/storage credentials and approved language/mandatory policy.
| Testing | Mock provider success/failure/timeout/translation; denied mic, unsupported MIME, empty/oversize uploads, ownership before disk write, network retry, source audio retained with transcript, browser/mobile format coverage.
| Acceptance criteria | Required notes cannot be skipped where policy applies; saved audio is retrievable only by authorized users; errors never display 'saved'; English output is verified against original language with provider validation separately authorized. |  <a id="r07"></a>
### R07 â€” Lead assignment, exact stage labels, history and conversion

**Priority:** P1. **Complexity:** Medium.   **Mapped incomplete requirements:** D02, D04, D05, D06, D08, D09, DS01, DS02, DS06.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Eight-stage Kanban and CRUD/value/date fields exist; ownership defaults to creator, next date is isolated, no history or conversion report.
| Required changes | Align literal stage labels; authorized reassignment; transactional stage history, closed reason/date, linked follow-ups; stage update not-found/error feedback and optimistic rollback; implement funnel/conversion definitions.
| Frontend files | lead-board.tsx, sales-hub.tsx, RM team/pipeline components and src/lib/api.ts.
| Backend files | server/sales-routes.mjs leads/activity/requests; server/rm-routes.mjs dashboard; report calculations in admin.mjs if required.
| Database changes | lead_stage_history (lead, old/new stage, actor, time); assigned owner/creator distinction if needed; closure metadata and follow-up lead linkage.
| APIs | Update POST/PATCH /api/sales/leads, /:id/stage; authorized assignment endpoint; history read and conversion report endpoint.
| Dependencies | R01 access matrix, R05 follow-up activity semantics; approved conversion denominator and stage transition rules.
| Testing | All eight exact labels, authorized assignment, immutable event order, repeat transition behavior, won/lost reopen, linked due dates, missing ID, cross-owner child deletion, failed optimistic update and conversion cohorts.
| Acceptance criteria | Each transition records actor/time; stage and follow-up remain consistent; authorized RM can assign; conversion report matches synthetic cohorts; UI rolls back failed changes. |  <a id="r08"></a>
### R08 â€” Consistent report dimensions, exports and overdue notifications

**Priority:** P1. **Complexity:** High.   **Mapped incomplete requirements:** C23, E10, E11, E12, E13, F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12, F13, F14, F17, G08.
| Planning field | Required work |
| --- | --- |
| Existing implementation | Date reports/groupings/drill-down/CSV/HTML-XLS/print exist; segment filters are absent, lists capped and notifications only queried in-app.
| Required changes | Implement explicit distributor/direct-customer/territory/manager definitions; propagate combinable date/region/product/person/customer filters into every aggregate/detail/export; separate pagination from full export; correct local-date presets; neutralize spreadsheet formulas; define pending/overdue notification channels/state.
| Frontend files | admin-reports.tsx, admin-management-reports.tsx, admin-product-trends.tsx, customer/product detail components, sales-hub.tsx, RM reports and api/types.
| Backend files | server/admin.mjs report/history/detail endpoints; sales-routes.mjs reports/alerts; rm-routes.mjs reporting/alerts.
| Database changes | Customer segment/territory/manager mappings if not supported by reliable existing fields; persisted notification status/dedup keys if push/scheduled delivery is approved; report scope metadata in generated_reports.
| APIs | Extend /reports/sales and detail/export contracts with validated filter IDs; add full export endpoints if needed; implement actual notification read/ack/delivery contract instead of relying on unused table.
| Dependencies | R02/R03 metrics; R01 scope; approved customer/territory taxonomy and notification channels.
| Testing | Combined filters vs independent SQL totals; >100 products/customers; date presets at IST midnight and FY rollover; exports match full eligible rows; CSV formulas/quotes; unread/overdue dedup; report-history scope and print rendering.
| Acceptance criteria | Same filters produce same totals across tables/graphs/details/exports; segments are explicit; empty dates stay empty; notifications have a defined delivery/read lifecycle. |

Remaining roadmap items continue in [R09–R12 and audit updates](./PSSPL_REQUIREMENTS_AUDIT_ROADMAP_2.md).

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
