# Phase 8 reconciled requirements

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

All 142 original IDs. Evidence: [E41](../../project-records/PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e41). Each row was reviewed against fresh isolated tests and source/acceptance limits.

| ID | Requirement | Status | Finding and remaining acceptance |
| --- | --- | --- | --- |
| A01 | Centralized admin dashboard | PARTIALLY COMPLETED | Authenticated dashboard APIs pass; actual dashboard rendering/navigation and clean initialization remain unaccepted. |
| A02 | Revenue and sales target KPIs | PARTIALLY COMPLETED | Net invoice and explicit target calculations pass P2/P4; earlier double-counting finding is superseded. Live control totals, target coverage and UI acceptance remain. |
| A03 | Daily, monthly, and YTD performance tracking | PARTIALLY COMPLETED | MTD/FYTD and fiscal-boundary fixtures pass; daily/all-screen period parity and date-preset defect UAT-02 remain. |
| A04 | Field coverage and salesperson activity | PARTIALLY COMPLETED | Visits, attendance and logged-call metrics persist in P5/P8; complete browser activity/coverage acceptance remains. |
| A05 | GPS-based sales team location visibility | PARTIALLY COMPLETED | Coordinates and accuracy are captured/validated synthetically; map rendering, GPS permission, staleness and device accuracy remain unverified. |
| A06 | List of all Relationship Managers (RMs) | PARTIALLY COMPLETED | RM directory and unique owner mapping are implemented; authoritative client roster and aliases require approval. |
| A07 | Underperforming RMs displayed first | PARTIALLY COMPLETED | Score-only ascending ranking and missing-target placement pass P4; displayed order requires browser acceptance. |
| A08 | RM performance ranking based on target achievement | PARTIALLY COMPLETED | Target-based ranking replaces revenue fallback and passes P4; live targets/mapping and displayed ranking require acceptance. |
| A09 | Daily management action list | PARTIALLY COMPLETED | Evidence-linked prioritized management actions exist and P4 helpers pass; thresholds and browser workflow remain pending. |
| A10 | "Needs Your Attention" section | PARTIALLY COMPLETED | Attention APIs and deduplication pass P2/P4; attention-card rendering and client policy acceptance remain. |
| A11 | Clickable RM names opening detailed report cards | PARTIALLY COMPLETED | Team links preserve financial year in source; actual click-through and report rendering are NOT VERIFIED. |
| A12 | Data consolidated from field sales and tele-sales | PARTIALLY COMPLETED | Logged calls and visits now persist in P5/P8; telephony verification, complete consolidated UI and client scope remain pending. |
| B01 | Monthly sales target vs actual sales | PARTIALLY COMPLETED | MTD explicit target/actual and no-target behavior pass P2/P3; production target coverage and browser acceptance remain. |
| B02 | Year-to-date sales target vs actual sales | PARTIALLY COMPLETED | FYTD actual/target agrees with management attention in P2; production target coverage and period acceptance remain. |
| B03 | Sales achievement percentage | PARTIALLY COMPLETED | Shared explicit-lakh target calculation passes P2/P3; mixed-unit profile targets are withheld. Client target reconciliation remains. |
| B04 | Sales performance trends | PARTIALLY COMPLETED | Zero-sales months and comparable-period product trends implemented; full chart rendering and live history remain unverified. |
| B05 | Total customer visits | PARTIALLY COMPLETED | Admin detail now counts team-owned visits by business date without the old customer OR predicate; source reviewed, full report/device acceptance remains. |
| B06 | Total customer calls | PARTIALLY COMPLETED | Admin detail now counts call/incoming/outgoing activities and P5/P8 verify call persistence; report-card browser acceptance remains. |
| B07 | Planned visits vs completed visits | PARTIALLY COMPLETED | Persisted planned/completed classification passes P4/P5/P8; no-show semantics and report-card rendering remain pending. |
| B08 | Pending and overdue follow-ups | PARTIALLY COMPLETED | Overdue binding and insights pass P2; current-state follow-up/history limitations and browser acceptance remain. |
| B09 | Top 5 dealers by revenue | PARTIALLY COMPLETED | Full eligible dealer population, beyond 50 detail rows, is verified by P2; real dealer control totals remain unverified. |
| B10 | Total active dealers | PARTIALLY COMPLETED | Distinct eligible invoice customer counts pass P2; authoritative dealer identities and actual report rendering remain unverified. |
| B11 | Dormant/inactive dealers based on invoice history | PARTIALLY COMPLETED | Invoice-history dormancy and insufficient-history rules pass P3; approved age threshold and complete live history remain. |
| B12 | New customers added in the last 6 months | NOT IMPLEMENTED | Customer creation timestamp/origin is absent; API intentionally returns null. Six-month new-customer metric is not implemented; obsolete fabricated-estimate defect removed. |
| B13 | Revenue concentration across dealers | PARTIALLY COMPLETED | Complete-population top-five concentration reconciles in P2/P3; live accounting denominator and UI remain unverified. |
| B14 | Top-selling products | PARTIALLY COMPLETED | Authoritative signed product aggregates pass P2; live invoice-line coverage and report/PDF acceptance remain. |
| B15 | Product-wise sales performance | PARTIALLY COMPLETED | Comparable-period product intelligence includes prior-only products; live mapping/line coverage and charts remain unverified. |
| B16 | Identification of underperforming dealers | PARTIALLY COMPLETED | History-based decline/dormancy classification passes P3/P4; approved thresholds, history completeness and client acceptance remain. |
| B17 | Actionable recommendations for improving RM performance | PARTIALLY COMPLETED | Server evidence-backed review actions pass P3/P4; action owner/due-date/closure tracking and business policy are incomplete. |
| B18 | Detailed drill-down from admin dashboard to RM report card | PARTIALLY COMPLETED | Linked RM report endpoint passes P2; click-through, tabs and rendered PDF/browser output remain NOT VERIFIED. |
| C01 | RM/SE login and authentication | PARTIALLY COMPLETED | Real HTTP login/logout and expiry pass P8 for all roles; browser login/session UX remains NOT VERIFIED. |
| C02 | Daily check-in and check-out | PARTIALLY COMPLETED | Actual-app check-in/check-out, duplicate guards and saved state pass P8; physical-device and browser acceptance remain. |
| C03 | GPS location capture | PARTIALLY COMPLETED | Valid coordinates/accuracy persist and invalid coordinates are rejected in P5/P8; physical GPS and permission states remain unverified. |
| C04 | Date and time tracking | COMPLETED | India business-date tracking passes P5; actual-app attendance, visit and call persistence passes P8. Narrow timestamp requirement verified synthetically. |
| C05 | GPS verification for physical customer visits | NOT IMPLEMENTED | No approved customer coordinates, distance rule or physical-visit geofence verification exists. |
| C06 | Customer visit creation and logging | PARTIALLY COMPLETED | Create/start/complete, owner denial and repeat guards pass actual-app P8; browser/device visit forms remain unverified. |
| C07 | Customer call logging | PARTIALLY COMPLETED | Incoming/outgoing call persistence, daily counts and follow-ups pass P5/P8; UI acceptance remains. Entries are not carrier-verified calls. |
| C08 | Mandatory logging of visits and calls | NOT IMPLEMENTED | Mandatory daily visit/call completeness gate and approved logging policy are absent. |
| C09 | Customer selection and details | PARTIALLY COMPLETED | Owner/team access passes P1/P8; customer list still slices to 100 and search/list browser coverage remains pending. |
| C10 | Product selection | PARTIALLY COMPLETED | Product reference and saved visit product are wired and P8 completion passes; actual product-selector interaction remains unverified. |
| C11 | Visit purpose | COMPLETED | Purpose required by creation endpoint and saved through actual-app P8 visit workflow; narrow persisted-field requirement verified. |
| C12 | Visit outcome | COMPLETED | Required outcome is validated and saved by actual-app P8 completion; invalid state/repeated completion are rejected. |
| C13 | Expected order value | COMPLETED | Nonnegative expected-order validation and saved value/day totals pass P5/P8 with synthetic value 2500. |
| C14 | Next follow-up date | COMPLETED | Date-only follow-up validation, creation and owner-protected completion pass P5/P8; malformed dates are rejected. |
| C15 | Voice recording for interactions | PARTIALLY COMPLETED | Synthetic byte upload/download passes P8 with owner/team protection; microphone, codec and actual recording acceptance remain NOT VERIFIED. |
| C16 | Speech-to-text transcription | PARTIALLY COMPLETED | Authenticated multipart STT returns a mocked transcript in P8; actual audio recognition/language/accuracy is NOT VERIFIED. |
| C17 | English transcription/translation where required | NOT IMPLEMENTED | No explicit English translation pipeline or accepted language/translation policy exists. |
| C18 | Original audio file storage | PARTIALLY COMPLETED | Original synthetic bytes round-trip through protected storage in P8; durable production audio storage, retention and backup remain unverified. |
| C19 | Mandatory voice-to-text notes where specified | NOT IMPLEMENTED | Mandatory voice-to-text submission is not enforced; recording/transcription remains optional. |
| C20 | Daily activity summary | BROKEN | UAT-01: fresh initialized database login succeeds but My Day returns HTTP 500 because profile columns are absent. Seed-compatible fixture summary passes; clean-start path is BROKEN. |
| C21 | Planned vs actual visits | COMPLETED | Planned/completed/pending counts pass P4/P5 and actual-app P8 completion persists one completed visit. |
| C22 | Daily expected order summary | COMPLETED | India-day expected-order value/count passes P5/P8; synthetic completed visit produces daily value 2500 without historical commitments. |
| C23 | Overdue follow-up notifications | PARTIALLY COMPLETED | Scoped overdue/due reminder payloads pass P7; browser visibility and any external notification acceptance remain pending. |
| C24 | Support requests for samples, quotations, and technical assistance | PARTIALLY COMPLETED | Service-request source/API and owner checks exist; complete sample/quote/support form acceptance remains unverified. |
| D01 | Lead creation | PARTIALLY COMPLETED | Owned lead creation/validation passes P6L/P8; actual create form remains unverified. |
| D02 | Lead assignment to RM/SE | PARTIALLY COMPLETED | Admin/RM team-limited reassignment and salesperson denial pass P6L; assignment selector interaction remains unverified. |
| D03 | Kanban pipeline interface | PARTIALLY COMPLETED | Kanban groups and stage controls are present in lead-board source; actual drag/button/layout acceptance remains NOT VERIFIED. |
| D04 | Lead stage updates | COMPLETED | Actual-app P8 progresses six stages with RM authorization and other-user denial; persisted stage update semantics verified. |
| D05 | Stage history tracking | COMPLETED | Actual-app P8 verifies six actor/time stage-history entries; P6L verifies no-op and scope behavior. Pre-migration history is not reconstructed. |
| D06 | Follow-up scheduling | PARTIALLY COMPLETED | next_action_date persists and validates; lead changes do not synchronize a linked follow-up/reminder lifecycle. |
| D07 | Expected order value | COMPLETED | Nonnegative lead expected value persists and negative inputs are rejected in P6L; narrow stored-value requirement verified. |
| D08 | Won/Lost tracking | PARTIALLY COMPLETED | Won/Lost enums and actor/time transition history exist; closure reason/date fields and reopening policy remain incomplete. |
| D09 | Lead conversion reporting | PARTIALLY COMPLETED | Scoped won-of-decided conversion passes P6L/P8; browser summary and client denominator approval remain pending. |
| DS01 | Pipeline stage: Lead | COMPLETED | Lead is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS02 | Pipeline stage: Technical Discussion | COMPLETED | Technical Discussion is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS03 | Pipeline stage: Sample | COMPLETED | Sample is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS04 | Pipeline stage: Quotation | COMPLETED | Quotation is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS05 | Pipeline stage: Follow-up | COMPLETED | Follow-up is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS06 | Pipeline stage: Order Expected | COMPLETED | Order Expected is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS07 | Pipeline stage: Won | COMPLETED | Won is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| DS08 | Pipeline stage: Lost | COMPLETED | Lost is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03). |
| E01 | Tally data import | PARTIALLY COMPLETED | Connector ingestion implementation exists; actual import workflow and authoritative live reconciliation remain unverified. |
| E02 | Support for initial exported Tally data | PARTIALLY COMPLETED | Workbook import exists but reconstructs invoice allocations; these projections are excluded from authoritative metrics, not accepted as real vouchers. |
| E03 | Live Tally synchronization, if implemented | NOT VERIFIED | No authorized live Tally agent/exchange was exercised. Server source is insufficient for live-sync acceptance. |
| E04 | Sales invoice extraction | PARTIALLY COMPLETED | Signed eligible sales/credit-note reporting passes P2/P8; cancellation state and full extraction/import acceptance remain incomplete. |
| E05 | Customer/dealer master extraction | PARTIALLY COMPLETED | Customer parsing/master source exists; durable company identity, owner mapping and approved live master reconciliation remain. |
| E06 | Product master extraction | PARTIALLY COMPLETED | Product parsing/master source exists; unit/rate/company mapping and complete live master reconciliation remain. |
| E07 | Product-wise sales | PARTIALLY COMPLETED | Signed complete product-line aggregates pass P2/P6R/P8; actual line completeness and mapping require approved Tally reconciliation. |
| E08 | Customer-wise sales | PARTIALLY COMPLETED | Full filtered customer aggregates beyond 100 groups pass P6R; authoritative live customer totals remain unverified. |
| E09 | RM-wise sales attribution | PARTIALLY COMPLETED | Owner/team attribution and cross-team exclusion pass P2/P7; live roster/aliases and effective-dated historical ownership remain unresolved. |
| E10 | Distributor-wise reporting | PARTIALLY COMPLETED | Admin Sales Reports dealer-type predicate is implemented and exercised by P6R; distributor taxonomy and cross-screen acceptance remain. |
| E11 | Territory-wise reporting | PARTIALLY COMPLETED | Admin report territory predicate is exercised by P6R; approved territory mapping and cross-screen UI acceptance remain. |
| E12 | Sales manager-wise reporting | PARTIALLY COMPLETED | RM/team scope and report totals pass P2/P6R/P7; live manager mapping and report rendering remain unverified. |
| E13 | Direct customer reporting | PARTIALLY COMPLETED | Customer/dealer filtering exists; distinct direct-customer taxonomy and approved segmentation remain unverified. |
| E14 | Historical sales data | PARTIALLY COMPLETED | Historical authoritative fixtures can be reported; reconstructed workbook history is excluded and complete genuine history remains unverified. |
| E15 | Sync error handling | PARTIALLY COMPLETED | Status/error and unavailable-data handling pass P4/P7; actual ingest interruption/recovery and live monitoring remain unverified. |
| E16 | Duplicate record prevention | PARTIALLY COMPLETED | Stable IDs/upsert/chunk checks exist; import replay, company collisions and staged overwrite/line replacement need dedicated ingestion tests. |
| E17 | Data freshness indicators | PARTIALLY COMPLETED | Missing/old/failed sync states pass P4/P7; browser indicators and approved freshness SLA remain unverified. |
| E18 | Mapping between Tally customers and CRM customers | PARTIALLY COMPLETED | Owner-ID mapping governs authorized customers in P1/P8; durable cross-source/company identity and live mapping approval remain. |
| E19 | Mapping between Tally sales and individual RMs | PARTIALLY COMPLETED | Unique CRM owner/team attribution passes P2/P7; shared alias parity, historical reassignment and real control totals remain. |
| F01 | Distributor-wise performance | PARTIALLY COMPLETED | Dealer-type filter now passes P6R; distributor classification, complete performance UX and client acceptance remain. |
| F02 | Product-wise performance | PARTIALLY COMPLETED | 100-group aggregate cap is removed and signed product totals pass P6R; actual line coverage and charts remain unverified. |
| F03 | Territory-wise performance | PARTIALLY COMPLETED | Territory filter exists in Admin Sales Reports and passes P6R; all-screen territory parity/mapping remains incomplete. |
| F04 | Sales manager-wise performance | PARTIALLY COMPLETED | Manager/team report filter passes P6R; consistent client-approved targets and browser acceptance remain. |
| F05 | RM-wise performance | PARTIALLY COMPLETED | RM target/actual and attention/card parity pass P2/P3; production mappings/targets and report rendering remain unverified. |
| F06 | Direct customer-wise performance | PARTIALLY COMPLETED | Complete customer aggregates pass P6R; explicit direct-customer taxonomy and segmentation remain unverified. |
| F07 | Date-range filters | PARTIALLY COMPLETED | Explicit backend date/FY filters pass P6R; UAT-02 reproduces India-midnight UTC shift in UI presets. Cross-screen period parity remains. |
| F08 | Region filters | PARTIALLY COMPLETED | Report region grouping exists; a report-wide region selector and consistent propagation are not established. Territory filter is not region parity. |
| F09 | Product filters | PARTIALLY COMPLETED | Product filter reaches complete backend aggregates and passes P6R; browser selection/export and all-screen parity remain unverified. |
| F10 | Salesperson filters | PARTIALLY COMPLETED | Salesperson/RM team filter passes P6R; actual UI selection and legacy-screen parity remain unverified. |
| F11 | Customer filters | PARTIALLY COMPLETED | Customer filter passes P6R/P8, including net value 900; actual UI/export interaction remains unverified. |
| F12 | Daily reports | PARTIALLY COMPLETED | Daily CRM activity and daily automation pass P5/P7/P8; complete daily sales report UI and approved period semantics remain. |
| F13 | Monthly reports | PARTIALLY COMPLETED | Monthly aggregation/scheduling fixtures pass P2/P7; UI date presets are defective and real monthly control totals remain unverified. |
| F14 | YTD reports | PARTIALLY COMPLETED | April-March and FYTD fixture boundaries pass P2/P7; UI preset defect, partial target coverage and live acceptance remain. |
| F15 | Graphs and visualizations | PARTIALLY COMPLETED | API-backed chart source exists; no actual browser chart or mobile layout was executed. |
| F16 | Detailed drill-down views | PARTIALLY COMPLETED | Detail APIs and RM report-card drill-down endpoint pass P2; actual dialogs, links and expansions remain unverified. |
| F17 | Exportable reports | PARTIALLY COMPLETED | Complete filtered aggregates and saved summaries pass P6R; CSV escaping is source-reviewed. Actual downloads, HTML .xls interpretation and complete paginated print/PDF remain unverified/incomplete. |
| F18 | Actionable insights based on actual data | PARTIALLY COMPLETED | Grounded server metrics and deterministic review actions pass P3/P4/P7; business thresholds and actionable workflow/client acceptance remain. |
| G01 | Ask AI / natural-language business query feature | PARTIALLY COMPLETED | Authorized scoped evidence selection and explicit periods pass mocked P7; broader BI and browser/live-provider acceptance remain. |
| G02 | AI answers based on authorized CRM/Tally data | PARTIALLY COMPLETED | Server-rendered facts reject fabricated provider values and cross-team context in P7; actual provider and live Tally evidence coverage remain unverified. |
| G03 | Voice-to-text via an actual speech recognition service | PARTIALLY COMPLETED | STT now requires authentication and P8 verifies mocked success; obsolete unauthenticated-endpoint finding removed. Real service accuracy remains unverified. |
| G04 | AI-generated performance observations | PARTIALLY COMPLETED | Grounded performance evidence/review rules pass P7; broader provider observations and client acceptance remain incomplete. |
| G05 | AI-based actionable RM coaching suggestions | PARTIALLY COMPLETED | Deterministic evidence-backed RM review suggestions pass P7; open-ended coaching and approved policy acceptance remain incomplete. |
| G06 | Automated scheduled reports | PARTIALLY COMPLETED | Persistent daily/monthly generation, restart catch-up, claims and bounded retries pass P7; approved live cadence and operations remain unverified. |
| G07 | WhatsApp report delivery | NOT VERIFIED | Mocked approved-template transport and signed callbacks pass P7; real opt-in/template/account/provider delivery is NOT VERIFIED. |
| G08 | Notifications for pending and overdue follow-ups | PARTIALLY COMPLETED | Scoped pending/due/overdue and visit payloads pass P7; actual notification UX and external delivery remain unverified. |
| G09 | Data access controls for AI features | PARTIALLY COMPLETED | Authenticated role-specific AI routes, cross-team denials and per-account throttling pass P7; clustered quotas and production acceptance remain. |
| H01 | Secure authentication | PARTIALLY COMPLETED | Scrypt login/logout/expiry passes P8; production admin seeding fails closed without a password in source. Browser token handling, HTTPS and configuration acceptance remain. |
| H02 | Role-based access controls | PARTIALLY COMPLETED | Unauthenticated, wrong-role and object-scope denials pass P1/P7/P8, including STT; complete deployment/endpoint security acceptance remains. |
| H03 | Restriction of access to sensitive sales/customer data | PARTIALLY COMPLETED | Customer, lead, follow-up, AI and audio owner/team denials pass P1/P7/P8; broader data inventory and deployment verification remain. |
| H04 | Secure handling of Tally data | PARTIALLY COMPLETED | Hashed bearer tokens and authoritative-source restrictions exist; request HMAC is not implemented and full connector ingestion/security lifecycle remains unverified. |
| H05 | Encryption in transit | PARTIALLY COMPLETED | Replication source now enforces certificate validation; prior insecure-TLS finding is superseded. Actual deployed HTTPS/origin/TLS enforcement remains unverified. |
| H06 | Appropriate protection for stored sensitive data | PARTIALLY COMPLETED | Password/session hashes and encrypted synthetic backups pass P1/P8; SQLite/audio storage protection, baseline handling and retention remain production decisions. |
| H07 | Logs and audit trails | PARTIALLY COMPLETED | Admin audit and Phase 7 redaction exist; complete login/denial/field/export audit coverage and operational monitoring remain incomplete. |
| H08 | Backup and recovery arrangements | PARTIALLY COMPLETED | Synthetic encrypted restore, integrity, tamper/wrong-key/overwrite rejection pass P1/P8; durable destination, schedule, key escrow, RPO/RTO and full audio recovery remain unverified. |
| H09 | Graceful handling of Tally connector downtime | PARTIALLY COMPLETED | Cached metrics and disconnected/failed sync states are exercised; staged-ingest interruption/recovery remains unverified. |
| H10 | System behavior when the CRM/backend becomes unavailable | PARTIALLY COMPLETED | Frontend retry/error source and attendance monitor tests pass; offline queue and guaranteed unsaved-form recovery remain absent, and browser failure UX is unverified. |
| H11 | Data export and portability | PARTIALLY COMPLETED | Full filtered financial aggregates and backup restore exist; complete CRM/customer/audio portability and actual export downloads remain incomplete/unverified. |
| H12 | Confidentiality controls | PARTIALLY COMPLETED | Role scope, provider minimization and audit redaction pass synthetic tests; retention, device/storage policies and client confidentiality approval remain. |
| H13 | Client data isolation, where applicable | NOT VERIFIED | Single-client tenancy applicability and deployed client separation have no acceptance evidence; role/team isolation is not tenant isolation. |
| H14 | Avoidance of production client data in development/testing without authorization | NOT VERIFIED | This UAT uses disposable synthetic records only; historical authorization for bundled/imported client data in development is unavailable. |
| H15 | NDA documentation/configuration evidence (no execution or legal-compliance inference) | NOT VERIFIED | No executed NDA or independent contractual confidentiality evidence is available; technical controls cannot establish legal execution. |
| I01 | RM/SE usage instructions | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I02 | Daily check-in procedure | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I03 | Customer visit logging procedure | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I04 | Call logging procedure | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I05 | Voice note procedure | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I06 | Lead pipeline usage instructions | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I07 | Follow-up procedure | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I08 | Admin dashboard user guide | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I09 | RM report card explanation | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |
| I10 | Training SOP documentation | COMPLETED | All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending. |

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
