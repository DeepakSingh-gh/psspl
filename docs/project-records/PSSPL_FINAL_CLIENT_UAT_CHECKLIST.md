# PSSPL Final Client Approval and UAT Checklist

**Status:** Prepared for client review; no approval or test result is pre-filled. Use an authorized isolated UAT environment only. Do not enter credentials, customer lists, full phone numbers or raw accounting exports in this repository.

## A. Decisions required before policy-dependent acceptance

For each row select an option, record approver/date/evidence reference, and identify any accepted limitation. Blank means pending.

| Requirement | Client decision to record | Suggested choices (client selects) | Decision / approver / date / evidence |
|---|---|---|---|
| B12 | Authoritative customer creation/origin date, “new” definition, six-month boundary and historical backfill | Supply dated source and backfill rule; approve prospective-only CRM-origin count; explicitly defer/unavailable | ____________________ |
| C05 | Customer coordinate provenance, radius/accuracy, location timing, retention, device/permission and offline exceptions | Approve measurable geofence policy; retain optional “unverified” evidence; defer physical verification | ____________________ |
| C08 | Required visit/call records, India-local cutoff, leave/no-activity/offline exceptions, escalation and override | Approve server-enforced gate and exceptions; warning/reminder only; defer enforcement | ____________________ |
| C17 | Source languages, English translation need, provider/privacy, quality criteria and retention | Approve named language/provider policy; source-language transcription only; defer translation | ____________________ |
| C19 | Covered interactions, consent, exemptions, failure behavior, original-audio/transcript requirements and deletion | Approve mandatory capture for named cases with exceptions; keep optional; defer mandatory use | ____________________ |
| H13 | Whether multi-client tenancy is in scope | Confirm single-client scope; if multiple clients, define tenant model and test environment | ____________________ |
| H14 | Authorization/disposition for historical or bundled client data in development/testing | Provide approved scope/reference; confirm no authorization and required containment/removal | ____________________ |
| H15 | NDA evidence review process | Name authorized legal/data reviewer and approved evidence channel | ____________________ |

## B. Access and environment authorization

- [ ] IT/data owner names the isolated UAT environment, operator and rollback owner.
- [ ] Finance authorizes a read-only Tally sandbox company/date range or supplies a minimal redacted export and control totals.
- [ ] Messaging owner authorizes a provider sandbox, test sender, approved template, consented test recipient and signed callback endpoint. No customer-recipient sends are included.
- [ ] IT confirms a disposable or approved copied database, reviewed schema/migrations, tested backup/restore and no connection to the protected production database.
- [ ] Security/data owner confirms HTTPS/origin, secrets, storage, audit/monitoring and retention test evidence for the UAT environment.
- [ ] QA records supported browsers, OS versions and actual Android/iOS devices. Viewport emulation is recorded separately from physical-device results.

## C. Client workflow UAT

Record each result as **PASS / FAIL / BLOCKED / NOT APPLICABLE**, tester, date, environment/build, evidence reference and defect/decision ID.

| ID | Role/device | Test | Expected result | Result / evidence / owner |
|---|---|---|---|---|
| U01 | Admin desktop | Sign in, dashboard, team and report navigation | Correct role pages load; visible totals and filters match approved data/control totals | ____________________ |
| U02 | Admin desktop | Filter date, region, territory/product/customer/RM dimensions as approved | API, screen and output use the same selected scope; unmapped values remain explicit | ____________________ |
| U03 | Admin desktop | CSV/XLS and print/PDF exports | Approved format opens; totals, filters and all expected rows reconcile; formula-like values are safe | ____________________ |
| U04 | RM desktop/mobile | Sign in, team scope, report card and drill-down | Own team only; linked periods and totals reconcile to admin-approved scope | ____________________ |
| U05 | Salesperson desktop/mobile | Sign in, My Day, customer/product selection, visit and call forms | Assigned records only; required validation, saved state and readable error recovery work | ____________________ |
| U06 | Salesperson physical device | Check-in/out, location permission/accuracy, visit start/complete, microphone/audio | Behavior matches approved C05/C08/C17/C19 decisions; denied permission, weak signal and provider errors are safe | ____________________ |
| U07 | Admin/RM/salesperson | Cross-role and cross-owner access attempts | Unauthorized records/actions are denied without leaking sensitive content | ____________________ |
| U08 | All supported roles | Empty/loading/error/backend-unavailable state and recovery | Clear state, safe retry, no false success; unsaved-work behavior documented | ____________________ |
| U09 | Phone and tablet | Layout, navigation, forms, tables/charts and horizontal overflow | Core actions remain reachable/readable on each approved physical device/browser | ____________________ |
| U10 | Sales management | Leads, stage changes, Won/Lost, reminders and conversion | Approved CA15 lifecycle/denominator is followed and actor/history is visible | ____________________ |
| U11 | Admin/data owner | Training and SOP walkthrough | User completes role workflow; corrections and acknowledgements are recorded | ____________________ |

## D. Integration UAT evidence

- [ ] Tally company identity, authorized period and owner/mapping policy are recorded.
- [ ] Sales, credit notes/returns, cancellations, tax/gross/net, duplicate vouchers, invoice lines and customer/product masters reconcile to owner-approved control totals.
- [ ] Tally exact retry, new-session replay, interrupted-transfer recovery, freshness state and rollback are tested without changing live accounting data.
- [ ] WhatsApp sandbox opt-in, template/language, one synthetic send, callback signature/state ordering, explicit rejection, ambiguous timeout, opt-out and disable/rollback are tested.
- [ ] No credential, recipient personal data or raw business records are attached to this checklist.

Use [PSSPL_LIVE_INTEGRATION_UAT_PLAN.md](./PSSPL_LIVE_INTEGRATION_UAT_PLAN.md) for detailed controlled procedures. These checkboxes remain pending until evidence is collected.

## E. Release decision and sign-off

- [ ] Every requirement is reconciled against evidence; partial, blocked and unverified items are not described as complete.
- [ ] Accepted exceptions list requirement ID, impact, approver, expiry/review date and owner.
- [ ] Production migration/backup/restore/rollback rehearsal is approved by IT; no UAT database is promoted blindly.
- [ ] Security/data owner approves production controls and integration owners revoke test credentials after UAT.
- [ ] Business owner accepts the final scope and remaining limitations.

**Client decision:** APPROVE / APPROVE WITH RECORDED EXCEPTIONS / REJECT  
**Business approver:** ____________________  **Date:** ____________________  
**IT/data approver:** ____________________  **Evidence reference:** ____________________  
**Conditions / exceptions:** __________________________________________________________

Approval of this checklist does not itself authorize deployment, production-data migration or customer messaging. Those actions require their own explicit operational authorization and change window.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
