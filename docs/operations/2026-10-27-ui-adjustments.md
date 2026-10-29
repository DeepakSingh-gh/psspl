# Local UI adjustments — 27 October 2026

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

This note records local presentation and additive read-only report changes. Verification is limited to the dated checks explicitly listed below; no deployment or changes to CRM/accounting records are claimed.

## RM performance report

- The **Actual sales / invoice detail** accordion and its invoice count are removed from the RM report card. RM Save Entries and other report sections remain.
- When Rais Khan's selected CRM range contains no saved entries, the report restores the five display-only RM Save Entries examples used by the client presentation. Existing real CRM entries always take priority and are never replaced or persisted by this fallback.
- In Rais Khan's FY 2026-27 report, missing monthly chart actuals and four reporting-week values may be filled with display-only sample values. FY 2025-26 now also provides four display-only weekly target and sales bars for every month, derived from and reconciling exactly to the existing monthly totals. Existing populated source values are preserved. Rows with fallback values carry chart provenance; these figures are not new invoices, verified sales, or AI evidence.
- The Thrust Products card no longer displays **Demo Preview**, **Demo**, or **Demo example** words. Existing displayed metric values are unchanged by this label cleanup.
- In the attendance heatmap, the **Future / unverified** legend item and the two demo explanatory lines are hidden. Calendar cells, attendance summary and detailed attendance view remain.

## Admin Team and Field Activity

- The Admin Team page hides its top information strip and the **PDF FYTD as of …** captions beneath target amounts. Target figures and remaining columns are unchanged.
- Field Activity retains Visits and Follow-ups tabs. Its Attendance tab and the associated check-in/route table are removed; the Check-ins summary card remains.

These changes are local source updates. No report calculations, permissions, APIs, source records, or deployments were intentionally changed by the presentation edits documented here.

## Overview, Pipeline and RM ranking updates

This section records the subsequent local changes on 27 October 2026. Earlier sections retain their original scope. No deployment or client acceptance is implied.

### Admin Overview

- Removed the **At a glance** card. The revenue chart fills the available row width.
- Removed the **Money / Collections** card, including its outstanding, receipts-banked and billed-this-year detail. Existing headline KPIs, accounting data and customer/receivables functionality remain. Field activity fills the remaining row.
- Removed **Planned customer visits** from Overview only. Saved visit records and the Field activity page remain.
- Renamed the Lead pipeline table heading from **Owner** to **RM**; underlying attribution is unchanged. Stage cards count their own stage: one Lead, one Quotation and one Won represent three total leads, not three entries in the Lead stage.
- Restyled **Quarter-wise Trend** as a white dashboard card with quarter badges, aligned sales totals, blue comparison bars and responsive quarter panels. Existing quarter sums are unchanged. Bars are relative to the highest recorded quarter and do not establish complete current-quarter coverage.
- The map canvas now uses `isolation: isolate` to contain its overlay and Leaflet layers. The floating **Refresh Data** button remains above the map without increasing its global stacking order. Desktop/mobile overlap checks confirmed the refresh button and map controls remain clickable.

### Product Trends and Pipeline presentation

- Product performance rows in `/admin/trends` are now non-clickable. The percentage/FY-share and units subtext beneath product names is hidden. Names, recorded sales values, bars and the Top selling / Declining / Low selling tabs remain. The View all products and View team navigation links are unchanged. Existing source/comparison calculations are retained; the previous 26 October guide describes the data recovery and its historical validation.
- In `/sales/hub` Pipeline, the summary shows **Total leads**, **Won** and **Lost** in three evenly spaced columns. The **Conversion rate** label/value and both explanatory states are hidden. The existing backend still calculates Won / (Won + Lost) × 100, rounded to one decimal place, with null when no decision exists. No lead records or stage transitions were changed.
- RM report snapshot **Demo Preview** badges and the matching PDF indicators are hidden. The local preview toggle reads **Start Preview / Exit Preview**; preview behavior and data provenance fields are retained. Earlier display-only chart, attendance or saved-entry behavior is not converted into verified source data by removing labels.

### Top Customers (5) and Top Products (5)

The current RM Report Card Performance Details area adds equal-width ranking cards above the existing Thrust Products section. Both cards use the same `RmTopSales` component in the dashboard and V2 PDF. Dashboard cards stack on mobile; PDF cards retain two columns, including export from a mobile viewport. Existing attendance, AI Insights, Manager Action Plan, Thrust Products and saved entries remain.

- **Customers:** reuse the report's customer-wise authoritative voucher totals, grouped by customer ID.
- **Products:** query signed authoritative invoice lines by recorded product master ID; lines lacking an ID use their exact recorded name. Different master IDs are never merged just because names or packing sizes resemble each other. The current master has no confirmed parent-product mapping, so packaging variants remain separate unless their recorded master ID already identifies the same item.
- **Ranking:** descending net sales, at most five rows, stable identity tie-breaks. Fewer than five real records display fewer rows; no names or sales are fabricated.
- **Share:** customer/product net sales divided by the selected report's total RM net sales, multiplied by 100 and rounded to two decimal places. It is not a share of the top-five subtotal. A zero or negative denominator produces N/A with a reason; valid recorded zero sales remain zero.
- **Scope:** the existing verified RM and optional subordinate salesperson IDs, selected FY and yearly/monthly/four-bucket-week date range, and financial cutoff are reused. Existing authoritative-source predicates exclude staged and generated `excel-import` rows. Credit notes and sales returns use the report's signed net-sales helpers. No source records, cancellation rules, schemas or existing formulas are changed.
- **Unavailable evidence:** aggregate PDF snapshots cannot establish customer/product invoice breakdowns. Missing ownership, future periods and absent authoritative evidence show a reasoned empty state. These server rankings never use client demo/snapshot fallbacks. A later explicit local frontend sample preview is documented below; it does not change server values.
- **Reconciliation:** all customer groups reconcile with voucher net sales; all product groups reconcile with signed invoice-line totals. Line/header differences are disclosed without allocating or overwriting amounts. Top-five rows alone need not sum to 100%.

Read-only local source audit on 27 October 2026:

| Rais Khan scope | RM voucher sales / all customer groups | All product groups | Lines minus vouchers |
| --- | --- | --- | --- |
| FY 2026-27, 1 April–27 October cutoff | ₹4,90,33,470.98 | ₹4,92,90,780.98 | +₹2,57,310.00 |
| August 2026 | ₹2,90,72,428.90 | ₹2,90,72,428.90 | ₹0 |
| 8–14 August 2026 | ₹8,66,370.15 | ₹8,66,370.15 | ₹0 |

These are dated observations from the inspected local database, not fixed business values. The FY customer ranking contained only two real customers; the tested week contained one. The product card discloses the FY variance. Missing line detail or recorded accounting adjustments must be obtained from the source to explain the difference; no balancing values were invented. Historical customer ownership remains unversioned and uses current verified assignments, as in the existing report.

### Implementation and recorded verification

Ranking implementation files:

- `server/rm-top-sales.mjs` and `server/rm-performance-report.mjs`: additive read-only projection and existing scope integration.
- `shared/rm-performance.d.mts`: optional `topSales` contract.
- `src/components/reports/rm-top-sales.tsx`, `rm-performance-view.tsx`, `rm-performance-pdf.tsx` and `rm-performance.css`: shared cards, aligned tables, green sales values and measured PDF pagination block.
- `scripts/rm-top-sales.test.mjs`, `scripts/rm-top-sales-browser.test.mjs` and extended `scripts/rm-performance-v2.test.mjs`: ranking, source and export checks. Synthetic fixtures are confined to tests and are never written to the live database.

Other presentation changes are in `src/components/admin/admin-overview.tsx`, `src/app/admin.css`, `src/components/admin/quarterly-trend.module.css`, `src/components/admin/admin-product-trends.tsx`, `src/components/sales/lead-board.tsx`, `src/app/hub.css`, `src/components/reports/client-snapshot-badge.tsx`, and `src/components/admin/rm-performance-workspace.tsx`.

Recorded ranking verification: **26 tests passed**, with four older opt-in browser cases skipped across the selected V2/V3/V4/pagination suites. The dedicated new browser test passed: yearly/monthly/weekly navigation, descending ranking and shares, snapshot empty states, long names, desktop/mobile layout, identical dashboard/PDF rows, PDF pagination and actual PDF download. PDF cards remain side by side on mobile export. TypeScript passed. Independent SQL checked the above source totals in read-only mode. QA artifacts are local under `scratch/rm-top-sales/`.

Quarter styling and map-layer checks also passed at desktop/mobile widths. TypeScript passed after the later card removals and Pipeline summary cleanup. Those later presentation edits were not a new full production build or a rerun of all earlier application suites. This documentation-only refresh does not rerun application tests, alter application code/configuration, change database records or deploy the project.

## Local top-five samples and RM dashboard cleanup

This subsequent 27 October update supersedes earlier statements that top-five cards always display verified rows only. Backend rankings remain real-data-only; the following examples are a separate, explicit frontend preview.

- In Rais Khan's report (RM code **033705**), choose **Start Preview** on the local Admin report toolbar to display sample ranking rows. **Exit Preview** restores the original real-data or unavailable state. The preview is restricted to an Admin session on localhost/loopback, the Admin report audience and the RM-level scope; subordinate salesperson selections and other RMs do not receive these samples.
- **Top Products:** only when the real list is empty, show five illustrative products: Acid Zinc Brightener, Pretreatment Surfactant, Zinc Blue Passivation, Chrome Catalyst and Nickel Brightener. A populated list, including valid zero-valued products, is preserved in full. Sample shares are 30%, 24%, 18%, 12% and 8%; amounts scale to a positive recorded report total where available, otherwise a separate sample basis. They are labeled illustrative and are not source transactions or verified product allocations.
- **Top Customers:** retain every existing real row and its recorded sales/share. If fewer than five rows exist, append enough explicitly named **Sample Customer** rows to reach five. Thus two real customers receive three samples; a full five-row real list remains unchanged. Sample shares are unavailable and the note states that sample rows are excluded from recorded totals and shares. No recorded total, customer total, product variance or report summary is recalculated to include samples.
- Both cards use the same presentation object/component in the dashboard and PDF, including sample labels. Samples are deterministic, created only in memory, and never saved to the database, sent as business writes, or used to change backend rankings or source sales calculations.
- The bottom **My Performance / Monthly target** card is hidden on the RM dashboard only. The shared Sales workspace retains this card for salesperson accounts; the top summary, targets, sales records, APIs and other dashboard functionality remain.

Implementation: `src/lib/rm-client-demo.mjs`, the optional preview metadata/row flag in `shared/rm-performance.d.mts`, and shared labels in `src/components/reports/rm-top-sales.tsx`. Tests were extended in `scripts/rm-top-sales.test.mjs` and `scripts/rm-top-sales-browser.test.mjs`. The RM-only card visibility condition is in `src/components/sales/sales-workspace.tsx`.

Recorded checks after the sample changes: **four focused unit tests and one browser/export regression passed**, plus TypeScript. Coverage includes real rows and zero preservation, no mutation, full/partial customer lists, Admin/host/RM/salesperson scope, preview exit, empty states and matching dashboard/PDF sample values. TypeScript also passed after the RM-only Monthly target removal. No new full production build or deployment is claimed. This documentation refresh does not rerun application tests.
