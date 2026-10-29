# Admin Product Trends and sidebar — 26 October 2026

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

This document records the latest local Admin UI changes. It does not establish a deployment, client acceptance or production-data update. Earlier dated implementation and test records retain their original scope.

## Product Trend data and comparison recovery

The subsequent Product Trends implementation investigates source records before supplying missing comparisons. This section supersedes earlier descriptions that all comparison-dependent sections simply remain unavailable. It does not turn unavailable YoY values into MoM values without labeling the change of baseline.

### Historical-source findings

- FY 2025–26 contains **11,340 `excel-import` invoice rows and zero authoritative dated invoice records** in the inspected database. The importer generated those rows by dividing annual product/RM totals into twelve equal months dated on the fifteenth. They remain excluded from genuine monthly and YoY calculations.
- Recorded annual comparison ledgers do exist: FY 2025–26 totals **₹13,03,75,839.16** across 538 product totals; FY 2024–25 totals **₹12,78,13,876.23** across 525 product totals. Read-only fallback can populate an otherwise empty, matching complete FY. It never adds these aggregates to overlapping invoices or spreads them into missing months.
- Current authoritative data spans April–September 2026, with the latest invoice dated **8 September 2026**. Sync runs with a later requested `date_to` do not by themselves establish complete dated sales coverage.
- The identity audit found no missing authoritative product IDs and no authoritative product ID with multiple recorded names. Incorrect packing-size matching was not the reason YoY was missing. Exact variants remain separate; family metadata does not merge grades, quantities or source records.

### Available calculations and labels

The FY sales value and product count remain **₹18.07 Cr and 552**. The original populated API figures, including valid zeros and existing historical annual comparisons, are preserved. A separate `recentComparison` object supplies alternatives only when the UI lacks a valid YoY comparison.

The latest complete comparison bounded by recorded history is **1–31 August 2026 versus 1–31 July 2026**. September's partial observations are not compared with a full August. The recorded result was:

| Metric | Recorded result |
| --- | --- |
| August item-line net sales | ₹6,18,97,289.73 |
| July item-line net sales | ₹3,22,40,588.20 |
| MoM growth | +91.99% |
| MoM increment | +₹2,96,56,701.53 |
| Gaining products with observations in both months | 91 |
| Declining products with observations in both months | 81 |

Existing cards now explicitly label **MoM growth**, **MoM increment**, **Previous month (MoM)** and the dated Need attention comparison when using this alternative. The first Current sales card still shows the FY total. Do not compare that ₹18.07 Cr FY amount directly with the ₹3.22 Cr July baseline; the MoM calculation uses August's ₹6.19 Cr.

What changed, Product movement and the Declining tab identify the same comparison months. Product rows retain their recorded FY amounts; the separate badge identifies MoM growth or FY sales contribution. The existing product drawer distinguishes its FY headline/units from its dated monthly revenue comparison. Percentage growth requires paired observations and a positive previous net-sales baseline; a missing observation is never treated as a fabricated zero to classify movement.

Within the **1 April–31 August 2026 observation window**, the recorded lifecycle results were **21** first observed selling positively in August, **228** without positive recorded net sales in August after earlier positive observations, and **109** selling positively in all five consecutive observed months. These are observation-window classifications, not newly launched or permanently discontinued status. Missing global months make consistent-selling classification unavailable.

The existing light theme, five KPI cards, three dashboard grids, FY controls, monthly/quarterly graph controls, blue/green series and all six available current-FY monthly observations remain. The YoY chart does not acquire a fabricated prior-year series; the alternative comparisons are labeled separately in the existing UI.

### Reconciliation and unavailable evidence

Product-wise quantities and net values were checked against independent invoice-line SQL. Item-line totals reconcile to the existing **₹18,07,05,690.49** product sales figure. Voucher headers total **₹18,05,65,444.28**, a header-minus-lines difference of **−₹1,40,246.21**; **137 vouchers lack item lines**. The UI discloses this variance rather than adjusting either source. Actual missing item lines and recorded tax/charge/return breakdowns are needed to explain or resolve it.

Monthly YoY still requires genuine prior-year dated vouchers and item lines for equivalent periods, plus comparable sync coverage. Annual snapshots and quantity × master-rate valuations cannot supply that evidence. Unquoted connector master rates defaulting to zero are not promoted into a missing period rate; already populated valid report zeros remain untouched. Current RM details use recorded customer/owner mappings; historical ownership versions are unavailable.

### Files and recorded verification

The latest comparison change modified only `server/product-trend-comparison.mjs`, `server/product-trend-data.mjs`, `src/components/admin/admin-product-trends.tsx`, `src/types/admin.ts`, `scripts/product-trend-comparison.test.mjs` and `scripts/product-trend-comparison-browser.test.mjs`. The preceding missing-field enrichment remains scoped to Product Trends and uses source-backed rates, monthly observations, month counts and RM details without changing raw tables.

Recorded validation: **19 focused unit/API tests and 3 browser regressions passed**, along with TypeScript and the production build. Independent SQL verified product amounts, quantities, monthly totals and lifecycle counts. Browser checks covered dated MoM labels, the unchanged FY total, explicitly unavailable YoY, five KPI cards, monthly/quarterly controls, FY switching, keyboard/touch interaction and 1440/768/390 layouts. Source hashes confirmed unrelated code/configuration was unchanged. No source records, dependencies or environment values were changed; nothing was committed or deployed.

When present locally, `scratch/product-trend-baselines/verification.json`, `audit.json`, `identity-audit.json`, `browser-audit.json`, screenshots and `build.log` contain the detailed evidence. These ignored artifacts are not guaranteed to exist in another checkout. This Markdown refresh records those results; it does not rerun application tests or the build. All numeric counts and amounts above are dated inspection results and may change after a genuine sync.

## Sales Performance Trend

Open **Admin → Product trends** (`/admin/trends`). The Sales Performance Trend card now matches the adjacent What changed card: white surface, light-grey border, 12px corners and the existing Admin shadow. It uses the Admin design tokens, inherited typography, a bold navy heading, grey subtitle/axes, subtle dashed horizontal gridlines and the existing light Monthly/Quarterly toggle. The tooltip has a white surface, dark text, a subtle border and shadow; positive and negative comparisons remain distinguishable.

Current FY remains blue (`#2769BE`), Previous FY remains green (`#308840`), with circular markers. Chart height remains 290px, the legend stays below the chart, and the responsive layout is unchanged. Loading, empty and unavailable-data states use the light surface.

The light-theme correction changed only:

- `src/components/admin/sales-performance-trend.module.css` — scoped colors, card, typography, toggle and tooltip styling.
- `src/components/admin/sales-performance-trend.tsx` — two SVG stroke styling attributes replaced by CSS classes.

It did not change data, amounts, formulas, API calls, FY comparison logic, monthly/quarterly aggregation, tooltip values or other sections. What changed was left intact.

## Existing data and interactions

The chart uses `adminApi.productTrends()` and `GET /api/admin/product-trends?fy=...`. The existing chart implementation adds `previousInvoiceCount` to monthly observations so a missing prior aggregate is distinguished from an observed net zero. The theme-only change did not modify that API or its calculations.

Months run April–March. Both series share a dynamic signed revenue axis that includes zero, using rupees/thousands/lakhs/crores as appropriate. Gaps represent unavailable or future observations; they are not invented zeros or interpolated line segments. Quarterly mode groups Apr–Jun, Jul–Sep, Oct–Dec and Jan–Mar. Missing required monthly evidence leaves the corresponding aggregate unavailable. The current UI displays **Data Not Available** with a reason for unsupported comparisons or a zero percentage denominator. Valid recorded amounts and quantities remain visible.

Hover, keyboard focus, arrow/Home/End navigation, Escape dismissal and touch interaction remain available. FY changes clear stale chart data while the selected scope loads. Grain changes make no extra API calls.

The inspected FY 2026–27 Tally snapshot had six current-month observations and no matching authoritative prior-year invoices. Its previous series was correctly unavailable. This is dated inspection evidence, not a claim that the live dataset can never change. The enrichment recovers genuine prior-only monthly invoice observations when they exist, leaving the missing current observation null. Periods without sufficient evidence remain gaps.

## Admin sidebar

`src/components/admin/admin-shell.tsx` no longer includes the **Reporting** group or its **Reports** and **Management reports** sidebar links. The entire group was removed, leaving no empty wrapper or reserved section gap. Field operations is followed directly by Administration.

All other sidebar items remain, including Users & access, Team structure, Archived employees, Tally data and Audit log. RM and Salesperson navigation was not changed.

The actual `/admin/reports` and `/admin/management-reports` pages remain available by direct URL or existing links elsewhere. Their components, APIs, permissions, database tables and backend behavior were not removed. This is navigation visibility, not access revocation.

## Recorded local verification

- Initial chart implementation: four helper tests, one isolated API test and two browser tests passed; TypeScript and production build passed. The API test distinguishes a verified sales/return net zero from missing prior invoices.
- Light-theme correction: desktop/mobile browser checks matched the adjacent card's surface, border, radius and shadow. Plotted values, tooltip text, chart height and surrounding dashboard HTML matched the before-change baseline. Four helper tests, the existing keyboard/touch/monthly/quarterly/FY-race browser regression and TypeScript passed.
- Source comparison confirmed that the light-theme component change was restricted to two SVG styling attributes; chart logic was preserved byte for byte.
- Sidebar removal: source checks confirmed removal of the Reporting group, the Field operations → Administration sequence and preservation of both route files. No new full-dashboard UAT was claimed for this small navigation change.
- This Markdown refresh checked source alignment and documentation links. It does not claim to rerun the earlier application tests or build.

When the earlier local QA artifacts are available, the light-theme screenshots are under `scratch/sales-trend-light/` and chart verification artifacts are under `scratch/sales-trend/`. These ignored local folders are not guaranteed to be present in another checkout.

## Product-count clarification

The earlier read-only product-master scan found 14,547 records, 13,884 exact names and 13,839 names after case/whitespace normalization. Removing recognized weight/volume pack labels yielded 12,861 base product names. That last figure is name-based grouping, not an approved product-master merge: model/grade suffixes such as `/2502-1` were retained separately. No products, quantities, prices or source records were changed. Counts are historical observations and must be rechecked after synchronization.

No application code, environment settings, business records, dependencies or deployment state are changed by the documentation refresh.
