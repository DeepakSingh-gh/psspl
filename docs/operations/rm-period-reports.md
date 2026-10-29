# RM report periods

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

> Current UI (24 October 2026): [V4](rm-performance-v4.md) adds attendance and the YTD product grid;
> [Rais Khan snapshot fallback](rais-khan-client-snapshot.md) fills labeled missing fields only.

> Earlier UI (23 October 2026): see [RM Report Card V3](rm-performance-v3.md) for the compact
> executive dashboard, grouped empty states, refresh behavior, cutoff correction and PDF QA.
> Its 23 October update removes the source-status strip and displays RM code `033705` for Rais Khan only.
> The saved-entry table now consolidates a completed visit with its linked order,
> follow-up and generated lead; planned visits stay on My Day. The thrust-product
> table remains under Customer & business performance. See [V3 current behavior](rm-performance-v3.md#current-compact-saved-entry-table).

> V2 update (23 October 2026): the active RM report workspace now uses a year-only selector,
> chart-based month/four-week drill-down, verified period narratives and measured multi-page
> PDFs. See [RM Performance Report V2](rm-performance-v2.md) for current behavior, data limits
> and verification. The V1 controls and fixed two-page notes below describe the earlier version.

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->


The V1/V2/V3 controls, two-page limits and section-order descriptions below are dated implementation history. The current status block and [current report/PDF record](rm-report-finalization.md) take precedence for the active workspace. Current ordering is header, Manager Action Plan, Performance Overview, sales charts, Attendance, Thrust Products, RM Save Entries, AI Insights. The separate invoice-detail accordion is no longer shown.

Updated: 22-10-2026

## Rais Khan presentation exception

Rais Khan's existing supplied report is reused for FY 2026-27 monthly, weekly
and annual financial graphs when live invoices are absent; its previous-year
monthly/annual figures cover FY 2025-26. This source takes priority over sample
financial values, even when CRM visits exist. No duplicate hardcoded financial
dataset is added. Blank achievements stay null and source rounding is preserved.
For his FY 2026-27 weekly selection, the existing four-week convention is used:
1–7, 8–14, 15–21 and 22–month end. No daily sales are fabricated from aggregates.
The supplied-source adapter never fabricates invoice or CRM detail rows.
For otherwise empty Rais Khan reports, the previously requested sample detail
rows remain separately labelled Demo; their sample sales totals use the selected
source aggregate. Unreported source achievements do not get sample sales rows.
Live invoices take priority over the supplied-report fallback.

Charts always render in the report card and PDF for every RM, including empty
periods; missing data is labelled while the axes and selected dates remain visible.

At the user's request, the UI adds a labelled, display-only demo for Rais Khan
when his selected period has no invoices, visits, calls, pipeline or follow-ups.
Actual operational records take precedence. The exception uses the selected dates
and feeds the same sample values to KPIs, charts, tables and PDF preview.
Other RMs retain the actual-only behavior described below. APIs keep their live
KPIs unchanged and provide Rais Khan's existing source aggregates separately;
no sample records are inserted into the database.
**View Report** selects the Report Card tab and scrolls to the report after loading.

The Admin RM detail page and `/rm/report-card` share the existing report card
and PDF generator. Reporting APIs use stored Tally invoices and CRM records.
The Rais Khan presentation exceptions above are applied separately in the UI
and PDF; other RMs do not receive those demo or supplied-financial fallbacks.

## Filters

Desktop controls use a compact toolbar. The report shows profile/service details,
then insights and actions side by side directly below Technical Service, followed by KPIs, chart, compact
product tiles and customer/product tables. Small screens stack these sections
without hiding report content. PDF generation retains the two-page A4 layout.

The financial-year dropdown contains FY 2024-25, FY 2025-26 and FY 2026-27 only.

- Weekly: financial year, month, and month-based week. Weeks run 1–7,
  8–14, 15–21, 22–28, and 29–month end when applicable.
- Monthly: full calendar month within the selected financial year.
- Yearly: 1 April through 31 March of the selected financial year.
- Dates appear as DD-MM-YYYY in the filters, report header, and PDF.
- Admin can select an RM; an RM account has no RM picker.
- Choose the RM and period in the stacked filter card, then press **View Report**.
  Editing filters does not request a new report until this button or **Download PDF** is pressed.
  **Download PDF** applies pending selections and opens the matching report preview;
  use its download button to save the PDF. It is disabled only while loading.
  Export failures show a retry message, and filenames use the selected period's dates.

## Data and permissions

Executive Territory Coverage shows executive-to-city mappings from the existing
supplied report's `teamEntries`, grouped by executive without dropping territories.
It includes the source date; these are source-report assignments, not inferred
from dealer locations or claimed to be historical CRM assignments. The same
mapping appears beneath the dashboard profile and on PDF page 2. Missing mappings
are explicitly unavailable.

`GET /api/admin/team/:id` accepts `reportType=weekly|monthly|yearly`,
`financialYear=YYYY-YY`, `month=1..12`, and `week=1..5` as applicable.
`GET /api/rm/period-report` accepts the same period parameters, resolves the
authenticated RM on the server, and uses the same reporting handler.
Admin selection options come from `/api/admin/rm-report-options`.

Sales, invoice lines, customers, visits, and calls use the selected dates and
the RM's verified account plus assigned salespeople. Credit notes reduce sales;
non-authoritative imported invoices are excluded by the existing accounting rules.
Open expected orders are selected by expected date (creation date if absent).
Open follow-ups are selected by due date. These are current stored statuses,
not reconstructed historical snapshots of whether a record was open at that time.
Attendance in the profile refers to the reporting period's end date.

Weekly and monthly charts show daily actuals; yearly charts show monthly actuals.
Stored monthly targets are prorated by calendar days for weekly ranges.
A missing target month leaves the complete period target and achievement unknown.
No target is inferred from the current profile or another reporting period.
Empty sections show **No Data Available**. Available target records may still
be shown when no sales have been recorded.

PDF headers, KPIs, charts, tables, and filenames use the selected RM and dates.
Detail tables retain the existing recent-row limits; KPI aggregates cover all
eligible records in the period. No model API or API key is required.

## Verification

Run `node --test scripts/rm-dynamic-periods.test.mjs scripts/phase3-rm-report.test.mjs`.
For browser and PDF checks against the local Next server, set `CRM_BROWSER_TEST=1`
and run `node --test scripts/rm-dynamic-periods.test.mjs`.
The tests create their fixtures and sessions in an isolated temporary database;
they do not insert or change production business records.

Download fix verified on 22-10-2026: all five dynamic-period tests passed,
including pending-filter preview, weekly/monthly/yearly two-page PDF downloads,
RM selection and access controls. `npx tsc --noEmit` also passed.

Executive coverage verified on 22-10-2026: all five dynamic-period tests passed
after adding the mapping. Browser assertions cover four grouped Rais Khan rows,
all source territories, identical dashboard/PDF content, PDF details fitting
above the footer, period selection, access controls and PDF downloads.
TypeScript and changed-file whitespace checks passed. These checks use isolated
test fixtures, not production records.

## Design preview versus implementation

The later Claude Call Sheet enhancement image is a design preview only. Separate
selected-period/FYTD comparisons, a consolidated Dealer Intelligence summary and
the proposed Before You Call section have not been implemented by that preview.
Its illustrative metrics are not verified CRM/Tally values or release evidence.
No production deployment or production-data change was performed for the compact
layout, download fix, executive coverage or this documentation refresh.
