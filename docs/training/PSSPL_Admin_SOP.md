# PSSPL CRM SOP: Administrator

Use admin access for company-wide oversight and account/data administration. Protect credentials and customer data; use only approved company devices and channels.

## Dashboard and reporting

1. Open the admin dashboard and confirm the reporting date/period before interpreting metrics.
2. Review **Needs Your Attention**, activity, team, customer, dealer, and RM report views.
3. MTD/FYTD sales use the shared Tally-based reporting logic. Target percentages are unavailable when a valid target is missing; do not estimate them.
4. Follow-up and visit alerts identify records needing review. A visit that passed its scheduled time without completion is not proof of a missed visit.
5. Use filters consistently when comparing report cards and exports. Check the period and units shown in the export.

## Tally sync and data quality

1. Check the latest Tally synchronization status before relying on sales reports.
2. If sync failed or data is stale, report the issue and communicate the affected period; do not substitute operational CRM estimates for accounting sales.
3. Investigate unmapped customers/dealers and RM attribution through approved mapping workflows.
4. Preserve source history. Do not delete invoices or change accounting figures to make reports reconcile.

## RM performance and management actions

1. Compare RMs and team members over the same reporting period and check whether targets are present.
2. Drill into the report card to review invoices, customers, dealers, products, visits, and follow-ups.
3. Treat provisional thresholds and data-quality alerts as review prompts. Confirm source records before taking personnel or customer action.
4. Assign follow-up owners and due dates in the CRM so management actions remain traceable.

## Ask AI

1. Ask a clear question and include the reporting period when relevant.
2. AI context is scoped to the authenticated user's permitted records and available business metrics.
3. Verify important conclusions in the underlying report. Missing or stale source data limits what AI can conclude.
4. Do not paste secrets, credentials, or unnecessary sensitive information into questions.

## WhatsApp reports and external delivery

Reports now use recipient-specific schedules. Delivery stays off until the business approves the recipient, the number belonging to that person, opt-in, template, language and timing. A salesperson receives their own scope; an RM receives their assigned team; an admin receives company scope.

1. Give the implementation administrator an approved list with account, number, daily/monthly timing in India time, opt-in evidence and approval reference. Do not put credentials in the CRM or a training document.
2. The implementation administrator creates a disabled schedule through the protected setup API. There is no schedule editor on the dashboard yet. Ask them to follow [the operator runbook](../operations/PSSPL_REPORT_AUTOMATION.md).
3. Review the sample report and approved template before authorizing enablement. Daily reports describe that day; monthly reports describe the complete prior month. CRM commitments remain current state.
4. Check delivery history: **accepted** means the provider accepted the request; **delivered/read** require a verified callback. **retry** means an explicit rate-limit rejection, with up to three attempts. **review/sending** requires investigation; do not resend an uncertain outcome.
5. Withdraw consent or disable a schedule through the implementation administrator immediately when requested. Disable the old manual WhatsApp workflow: its send action now explains that an approved schedule is required.
6. Missing configuration, missing approval, inactive accounts and reports too long for the approved template prevent delivery. Review failures in the protected delivery history, never by copying tokens or provider error payloads.

No live delivery has been tested in Phase 7. In-app reminders do not send WhatsApp messages. Approved live verification must be arranged separately.

## Exports, access, and operations

- Export only the data needed for the approved business purpose and store it in an approved location.
- Assign users to the correct role and manager/team; verify access after ownership changes.
- Do not edit `.env`, credentials, or production data as part of routine report review.
- For backup/recovery or schema changes, follow the reviewed deployment and recovery runbook; validate restores on a separate path first.
- Escalate unauthorized access, unexpected exports, data corruption, or failed recovery promptly through the company's incident process.

## Reporting filters and practice exercise

Open **Sales Reports**, select the date range or financial year, then use customer, product, RM/salesperson, territory and dealer type where needed. Check the displayed total and source before exporting. CSV/Excel includes the complete returned aggregates; Print/PDF still follows the paginated view. Filters on this screen do not automatically apply to every older dashboard.

For Ask AI, select the dates using the date controls; putting dates only in the question does not change the selected period. Answers show the period, source, sync age and evidence. The provider selects relevant evidence; the CRM supplies the figures and review actions. Unsupported questions return an unavailable explanation. Product rankings show only the top five, not all products or an approved thrust list.

Practice in an approved training environment: filter one month, export it, compare its net total with the report, ask AI for the same period, identify a missing target and a sync warning, and review a mocked delivery failure. Do not send a real message for training.

Trainer: __________  Trainee: __________  Date: __________
Record demonstrated tasks and open questions; business training acceptance remains pending.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
