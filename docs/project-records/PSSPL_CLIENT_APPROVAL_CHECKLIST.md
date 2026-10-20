# PSSPL client approval checklist

Date: 18 October 2026 (Asia/Kolkata)
Phase: 8 final UAT
Current acceptance: **FAIL**. These are pending decisions and evidence requests, not approvals granted by this document.

Palak Ma'am is the business acceptance owner. Finance, IT/operations, field representatives and the data/privacy owner should provide the supporting evidence indicated below. Record approver, dated decision, evidence reference, implementation/retest owner and any accepted limitation. Do not paste credentials, phone lists or customer data into this checklist.

| ID | Decision or evidence required | Decision basis and proposed next action | Supporting owner | Status | Deployment impact |
| --- | --- | --- | --- | --- | --- |
| CA01 | Confirm original requirements and meeting provenance | Supply/confirm September 1, 8 and 26, 2026 records and validate the existing 142-row baseline; resolve any omitted decisions | Palak Ma'am | PENDING | Final scope sign-off blocked |
| CA02 | Approve fresh-schema defect remediation and retest | UAT-01 reproduces My Day HTTP 500 on fresh initialization; require reviewed additive schema completion and tests without fixture shims | Engineering and IT | PENDING | Release blocked |
| CA03 | Approve date-preset correction and acceptance | UAT-02 shifts India month-start to previous UTC day; require local-calendar date serialization and India-time preset tests | Engineering and Finance | PENDING | Reporting acceptance blocked |
| CA04 | Authorize separate live Tally reconciliation | Approve read-only extract/access, company, periods, secure handling and named operators; no live access granted in Phase 8 | Finance and data owner | PENDING | Accounting sign-off blocked |
| CA05 | Voucher and control-total policy | Confirm sales, credit notes, returns, cancellations, duplicates, tax/gross/net and company identity; current schema does not represent cancellation | Finance | PENDING | Accounting sign-off blocked |
| CA06 | Approve RM roster and attribution | Confirm account/team/customer ownership, aliases, unmapped exceptions and historical reassignment treatment; automation uses stricter exact-name target matching | Sales management and Finance | PENDING | Reliable RM scoring blocked |
| CA07 | Approve targets and units | Confirm explicit monthly lakh targets, missing months, zero targets, partial-month and historical-year conventions; ambiguous profile target units remain withheld | Finance and sales management | PENDING | Target/achievement acceptance blocked |
| CA08 | Agree freshness SLA and data coverage | Set acceptable sync age, failure escalation, invoice/line/history coverage and owner; timestamp alone cannot certify complete data | Finance and IT | PENDING | Reliable reporting operations blocked |
| CA09 | Approve alert thresholds | Review provisional target 80%, concentration 70%, dormancy 90 days and visit completion 70%; record approved values or revised rules | Sales management | PENDING | Alerts remain provisional |
| CA10 | Confirm outstanding/missed visit policy | Current past scheduled incomplete visits require confirmation; decide whether a supervisor-confirmed no-show state is needed | Sales management | PENDING | Definitive missed-visit reporting blocked |
| CA11 | Supply reliable customer-origin data | Six-month new-customer count is unavailable; approve source/date/migration strategy, or explicitly defer this requirement | Finance and sales management | PENDING | B12 remains missing |
| CA12 | Confirm GPS acceptance policy | Decide whether optional GPS is acceptable; define accuracy, customer coordinates/geofence, retention and permitted physical-device tests | Field management and data owner | PENDING | Physical-visit verification blocked |
| CA13 | Mandatory daily logging policy | Decide required visit/call completeness and end-of-day enforcement; no mandatory completion gate exists | Sales management | PENDING | C08 remains missing |
| CA14 | Recording, transcription and language policy | Approve recording consent, optional/mandatory voice notes, supported languages, English translation, retention/deletion and approved real-device/provider tests | Data owner and field management | PENDING | C17/C19 and audio acceptance blocked |
| CA15 | Lead lifecycle and reminders | Confirm Won/Lost closure reason/date, reopening/transition rules, conversion denominator and linked next-action reminders | Sales management | PENDING | Full pipeline acceptance blocked |
| CA16 | Dealer/territory/direct-customer classification | Approve distributor versus direct-customer taxonomy, territory/region mapping and filter parity expected across legacy screens | Finance and sales management | PENDING | Segmentation acceptance blocked |
| CA17 | Export acceptance and portability | Decide on HTML .xls versus native .xlsx, complete unpaginated PDF/print, expected total/row checks and full CRM/audio export needs | Finance and IT | PENDING | Export acceptance blocked |
| CA18 | Approve AI scope and live test | Accept seven bounded evidence sections and deterministic server facts, provider/data handling and explicit period controls; authorize any separate paid test with limits | Palak Ma'am and data owner | PENDING | Live AI acceptance blocked |
| CA19 | Approve WhatsApp recipients and consent | Verify account/number ownership, purpose, opt-in/revocation evidence and company/team scope using a protected recipient list | Palak Ma'am and data owner | PENDING | Real sending must remain disabled |
| CA20 | Approve WhatsApp template and cadence | Approve sample report, template/language, daily/monthly timing in India time, supported Graph version and live webhook/delivery test | Business owner and messaging operator | PENDING | Real sending must remain disabled |
| CA21 | Assign delivery failure operations | Assign owner for held/ambiguous sends, retries, opt-outs and callback monitoring; no blind resend of uncertain outcomes | IT and messaging operator | PENDING | Automation rollout blocked |
| CA22 | Approve migration/startup rollout | Review complete fresh schema, pending migration state, backup/restore and rollback procedure before existing-database startup or migration flags | IT and engineering | PENDING | Existing-data changes blocked |
| CA23 | Approve durable recovery configuration | Specify SQLite/audio storage, encrypted off-host backup, key escrow, retention, scheduler, alerts, RPO/RTO and production-equivalent restore drill | IT and data owner | PENDING | Production recovery blocked |
| CA24 | Approve production security and monitoring | Verify HTTPS, CORS/API URL, secret-managed admin initialization, stored-data access, audit gaps, incident alerts and shared limits for multiple workers | IT and data owner | PENDING | Production configuration acceptance blocked |
| CA25 | Confirm isolation and confidentiality evidence | Determine single-client isolation applicability, authorize historical development data use and supply NDA execution evidence through an approved channel | Palak Ma'am and data owner | PENDING | H13-H15 remain NOT VERIFIED |
| CA26 | Execute browser and physical-device checklist | Complete [20 browser/mobile cases](../uat/phase8/browser-mobile-checklist.md), retain actual evidence and approve supported browsers/devices | QA, RM and sales representatives | PENDING | User acceptance blocked |
| CA27 | Deliver training and obtain acknowledgements | Use the three authored SOPs; demonstrate real workflows, resolve questions and collect named sign-offs | Trainer and business representatives | PENDING | Operational user acceptance blocked |
| CA28 | Final UAT acceptance and Phase 9 authorization | Review defects, reconciled counts, all remaining limitations and approved exceptions; rerun failed/unverified acceptance before signing | Palak Ma'am | PENDING | Phase 9 must not start automatically |

Approval record: Approver __________ Date __________ Decision/reference __________ Conditions __________

No production deployment, live Tally access, paid AI/STT call, real WhatsApp delivery or Phase 9 work is authorized by completion of the local Phase 8 verification.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
