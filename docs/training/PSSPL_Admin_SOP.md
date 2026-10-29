# PSSPL CRM SOP: Administrator

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

<!-- oct27-ui-details:start -->
## Latest Overview and ranking usage

Overview no longer includes At a glance, Money / Collections or Planned customer visits. Use the existing headline KPIs, Field activity and Customers pages for those records. Pipeline stage cards count each stage, while Total leads spans all stages; the sales Pipeline summary now shows Total leads, Won and Lost only. In RM Performance Details, select RM/salesperson and FY/month/week before reading Top Customers / Top Products. Share uses all selected RM net sales, not the top-five subtotal. Respect empty-state reasons and product-line/voucher variance; do not fill gaps with examples. Download PDF uses the same ranked rows.


Latest follow-up: [Local preview and RM dashboard scope](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup): **Start Preview / Exit Preview** controls optional Rais Khan sample rows. Empty products receive five examples; a short customer list keeps real rows and appends marked samples to five. Sample customer shares are unavailable and totals remain recorded values. Dashboard/PDF labels match; no persistence occurs. The bottom Monthly target card is hidden for RM accounts only, with the salesperson card retained.
<!-- oct27-ui-details:end -->

## Current RM Report Card workflow - 27 October 2026

Where your role has access to the RM Report Card, choose the FY/reporting scope in the existing toolbar, then review **Manager Action Plan** immediately below the RM header, before Performance Overview. The chart drills from FY to month to four reporting weeks. In Rais Khan FY 2026-27, missing chart values can be display-only examples, marked in the chart; they are not recorded invoices or verified results. The separate invoice-detail accordion is no longer shown. AI Insights remains after RM Save Entries.

Actual has the smaller second-line legend `(<100%)`; Target met has `(≥100%)`. Colors, tooltips and chart calculations are unchanged. Attendance fillers are decorative, not additional dates or records. Desktop product cards use four columns and continue to adapt on smaller screens.

Use Download PDF to review the paginated preview, then download the same pages. PDF retains four-column product rows, the complete eight-column saved-entry export and all insights/actions; screen search and the current saved-entry page do not limit export. Page count varies with content, and the old supporting-detail appendix is removed. Check the selected period before sharing a report; existing role/ownership limits still apply.



Use admin access for company-wide oversight and account/data administration. Protect credentials and customer data; use only approved company devices and channels.

## Dashboard and reporting

1. Open the admin dashboard and confirm the reporting date/period before interpreting metrics.
2. Review **Needs Your Attention**, activity, team, customer, dealer, and RM report views.
3. Check the source label: live MTD/FYTD uses Tally reporting, while the 12 supplied RM reports use dated PDF snapshots from 30 September 2026. Target percentages are unavailable when a valid target is missing; do not estimate them.
4. Follow-up and visit alerts identify records needing review. A visit that passed its scheduled time without completion is not proof of a missed visit.
5. Use filters consistently when comparing report cards and exports. Check the period and units shown in the export.

## Tally sync and data quality

1. Check the latest Tally synchronization status before relying on sales reports.
2. If sync failed or data is stale, report the issue and communicate the affected period; do not substitute operational CRM estimates for accounting sales.
3. Investigate unmapped customers/dealers and RM attribution through approved mapping workflows.
4. Preserve source history. Do not delete invoices or change accounting figures to make reports reconcile.

## Product trends and report navigation — 26 October 2026

1. Open **Product trends** and use the existing FY selector. **Sales Performance Trend** uses the same light card theme as the surrounding dashboard.
2. Switch **Monthly / Quarterly** as needed. Hover, keyboard-focus or tap a period for the existing current/prior sales, difference and growth values. Missing/future data remains unavailable; do not interpret a gap as zero.
3. Read each comparison label. When YoY evidence is unavailable, **MoM growth**, **MoM increment**, **Previous month (MoM)** and Need attention use the explicitly dated recent-month comparison. The Current sales headline remains the FY total; do not compare it directly with the monthly baseline. Product rows retain FY amounts while badges identify MoM growth or FY contribution. The drawer labels its monthly revenue baseline separately from FY totals.
4. Movement requires observations for the exact variant in both months. Lifecycle means first observed within the stated history, no positive recorded net sales in the stated month, or positive sales in every consecutive observed month. These labels do not establish a launch or permanent discontinuation. Check the latest recorded invoice date, sync coverage and reconciliation note; do not infer missing months as zero or use annual totals as monthly YoY.
5. The Admin sidebar no longer shows **Reporting**, **Reports** or **Management reports**. Existing report pages remain at `/admin/reports` and `/admin/management-reports`, subject to their existing permissions. Other navigation remains unchanged.

[Current Admin UI guide](../operations/admin-product-trends-and-sidebar.md).

## RM performance and management actions

1. Compare RMs and team members over the same reporting period and check whether targets are present.
2. Open an RM report card, select the financial year and use the chart for month/four-week
   drill-down. The Salesperson control lists assigned accounts; select a person for that scope
   or retain **RM & full team**. Review the separate financial and CRM cutoffs.
   Attendance uses the selected person's own records; its local month arrows do not change sales
   selection. Missing check-ins remain unverified without an approved absence policy. Thrust
   Products shows YTD product net sales and contribution to company-wide net sales on matching dates.
   Compact **Demo Preview** badges identify fallback values. Populated values and valid zeros
   retain priority; missing thrust metrics are visually blank in live mode. On localhost only,
   Admin can explicitly choose **Start Demo Preview** to show stable sample attendance and
   missing product examples. **Exit Demo Preview** restores the real report; changing RM/FY/person
   resets preview. Demo data is never valid payroll or personnel-decision evidence.
   Review **RM Save Entries**, **AI Insights** and **Manager Action Plan**. Saved-entry pagination
   remains; the PDF includes all entries in scope and full-FY attendance for FY/month/week exports.
   See [demo and export guide](../operations/rm-report-finalization.md).
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


## Account administration - 21 October 2026

1. Open **Users & access** (`/admin/users`) and **Add user**. Enter name, Login ID, email, mobile, role, initial password and confirmation, reporting RM for a salesperson, region, territory, employee code and monthly target. A blank employee code is generated.
2. Choose **Create user** to save without email, or **Create user & Send Email** to explicitly send all saved employee details, Login ID, registered email and the entered initial password in a professional email. The account is active immediately; first-login password change is optional.
3. To email an existing employee, open **Manage → Account email**, re-enter their current password if it should be included, approve the recipient and choose **Send Account Email**. The API verifies that password but never retrieves it. Leave it blank for details only. If the current password is unknown, use Manage to reset it first; resetting signs out all devices. Do not enter passwords in chat or documents.
4. **My profile** changes your own password voluntarily. It is separate from employee account administration.
5. Open **Team structure** to see RM counts and each RM's assigned salespeople. Search retains the parent RM context.
6. **Delete** removes sign-in access while preserving CRM history. Reassign an RM's reporting employees first. Self-deletion and deleting the last active admin are blocked.
7. Open **Archived employees** for read-only paginated history. **Restore employee** sets new sign-in credentials on the retained employee identity; salespeople need an active RM. Customer ownership reflects current saved assignments. Removed mobile numbers/notifications and disabled report schedules are not automatically restored; restoration sends no email by itself.
8. On Team performance, check the displayed sorting basis: known achievement ascending for Poor to good and descending for Good to poor; unavailable achievements remain last in either direction. Sales is used only when no member has achievement data.


## Email delivery and field-location checks

- The current temporary email sender is `deepaksingh873785@gmail.com`; SMTP credentials are backend-only. The final admin mailbox requires its own SMTP credentials. See the [email operator guide](../operations/gmail-smtp-authentication.md).
- The **Email / Send Test Email** control is no longer shown in Users and roles. Account emails remain in the user-management flow; provider acceptance does not confirm inbox delivery.
- If a second click hits cooldown, inspect the previous delivery status; do not recreate the user. An accepted email may require checking Inbox and Spam. Ambiguous SMTP submission is held for review rather than automatically resent.
- An account email can contain all employee details and a supplied password even without a public URL. It omits unusable local links. A user on another device still needs a reachable CRM using the correct account database before sign-in or reset links can work.
- Field Activity now has **Visits** and **Follow-ups** tabs. Its Attendance tab and check-in/route detail table are no longer available there; the summary still shows total Check-ins. The Attendance heatmap in the RM report remains available. See [the 27 October UI note](../operations/2026-10-27-ui-adjustments.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.

<!-- rm-report-current:start -->
## Historical RM report card - 22-10-2026

- Select an RM (Admin only), Weekly / Monthly / Yearly, financial year, month and week as applicable. Press **View Report** to apply and open the Report Card tab. RM accounts remain restricted to their authorized data.
- Desktop filters are compact; KPIs and chart come first, with insights/actions side by side and stacked mobile sections. PDF retains two A4 pages.
- **Download PDF** also applies pending filters, opens the matching preview and saves from its download button. Export errors provide a retry message; filenames use selected-period dates.
- Executive Territory Coverage groups each executive with their cities beneath the profile and on PDF page 2. The supplied-report date is visible; dealer locations are not substituted as executive assignments.
- Rais Khan reuses existing supplied monthly/weekly/yearly financial data when live invoices are absent; separately labeled sample details remain a documented presentation exception. Missing source achievements stay unavailable. Other RMs receive no sample fallback.
- Latest local checks: all 5 dynamic-period tests, TypeScript and changed-file whitespace checks passed, including dashboard/PDF mapping parity and PDF footer fit.

See [period rules, source limitations and verification](../operations/rm-period-reports.md) and [other UI/loading changes](../operations/2026-10-22-ui-and-performance.md). The proposed Claude Call Sheet image is a preview, not an implemented feature set. No production deployment or production-data modification was performed for these updates.
<!-- rm-report-current:end -->
