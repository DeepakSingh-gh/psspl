# CRM UI and loading updates — 22 October 2026

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

This page records the latest local changes. Historical release reports retain their original dates and scope; no production deployment is established by these updates.

## RM workspace

- RM sign-in opens `/sales/my-day` again. Existing `/rm` bookmarks redirect there. Admin sign-in opens `/admin`.
- My Day supports both RM and Salesperson profiles; an RM profile lookup failure was corrected.
- The **Log a customer call** panel is hidden for RMs. Salespeople retain it. Existing call records are preserved.
- Lead cards no longer display **Stage History**. Stored stage transitions remain intact.
- No credentials or environment secrets are included in this documentation.

## My Day loading

- The UI requests `/api/salespeople/me/my-day?view=workspace`.
- Workspace responses retain all product IDs/names, assigned customers, visits, follow-ups, attendance and displayed performance; unused product metadata and overview insights are omitted.
- The workspace skips the unused repeat-sales calculation and RM alias-directory build. The default API response remains available for existing callers and mutation responses.
- Simultaneous My Day reads share an in-flight request per session; completed requests are not cached by this change.
- Local payload size fell from about 2.4 MB to 1.1 MB, retaining 14,547 product options. Measured workspace API timings were about 80–100 ms in one run, with slower runs under load. Browser startup and development compilation add time.

## Admin loading

- Sidebar hover/focus prefetches supported routes and initial data, sharing pending requests with navigation.
- Product Trends uses 11 SQL queries instead of 17, with identical responses for both financial-year baselines checked.
- Migration `015_report_query_indexes.sql` adds covering invoice/line indexes and was applied locally. Target deployments must apply their own reviewed migrations.
- A loading indicator appears during admin route transitions. Existing Refresh Data behavior remains available.

## Sales Reports

- The advanced-filter box and **Saved management reports / Report history** section were removed from the page. History is no longer fetched there; saved records and backend endpoints are retained.
- From/To dates, quick ranges, five grouping views, pagination, CSV, Excel and Print / Save PDF remain available.
- **Save report** remains available, saving the generated report's date range, grouping and returned filters.
- Generate requests fresh data even when the dates have not changed. Changed dates disable export/save until generated; loading and failed reports cannot be saved/exported.
- Invalid ranges, empty results and save failures have visible messages. Displayed summary dates use DD-MM-YYYY.
- The checked local authoritative invoice range was 01-04-2026 to 08-09-2026. Zero sales for 16-10-2026 to 22-10-2026 matched the local ledger; these dates describe that check, not a fixed application limit.
- Excel currently downloads an HTML table in an `.xls` file; Print / Save PDF uses the browser print dialog.

## Users and roles

- The **Email / Send Test Email** button and dialog were removed from Users and roles.
- Account emails, invitations, password recovery, provider configuration and server email endpoints remain separate existing capabilities. This update sends no email.

## Verification

- `npx tsc --noEmit` passed after the Sales Reports simplification; later UI changes received targeted checks as described below.
- `scripts/admin-sales-reports-browser.test.mjs` passed after removal of the filter/history sections: grouping, full-row exports/print, date changes, regeneration and save-error handling.
- `scripts/phase6-reports.test.mjs` and `scripts/phase2-tally-accuracy.test.mjs` passed together (9 tests) before the section removal; backend calculations were unchanged by that removal.
- `scripts/verify-my-day-workspace-performance.mjs` matched full and workspace responses after accounting for intentional omitted fields, for Rais Khan and Anil Jena.
- Targeted browser verification confirmed the RM My Day identity loads and the call-logging panel is absent.
- Admin navigation/cache/refresh browser checks and financial regression checks passed during the loading work. These are local measurements and checks, not production guarantees.

<!-- rm-report-current:start -->
## Historical RM report card - 22-10-2026

- Select an RM (Admin only), Weekly / Monthly / Yearly, financial year, month and week as applicable. Press **View Report** to apply and open the Report Card tab. RM accounts remain restricted to their authorized data.
- Desktop filters are compact; Insights/actions appear side by side directly below Technical Service, followed by KPIs and chart, with stacked mobile sections. PDF retains two A4 pages.
- **Download PDF** also applies pending filters, opens the matching preview and saves from its download button. Export errors provide a retry message; filenames use selected-period dates.
- Executive Territory Coverage groups each executive with their cities beneath the profile and on PDF page 2. The supplied-report date is visible; dealer locations are not substituted as executive assignments.
- Rais Khan reuses existing supplied monthly/weekly/yearly financial data when live invoices are absent; separately labeled sample details remain a documented presentation exception. Missing source achievements stay unavailable. Other RMs receive no sample fallback.
- Latest local checks: all 5 dynamic-period tests, TypeScript and changed-file whitespace checks passed, including dashboard/PDF mapping parity and PDF footer fit.

See [period rules, source limitations and verification](rm-period-reports.md) and [other UI/loading changes](2026-10-22-ui-and-performance.md). The proposed Claude Call Sheet image is a preview, not an implemented feature set. No production deployment or production-data modification was performed for these updates.
<!-- rm-report-current:end -->
