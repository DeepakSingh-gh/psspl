# Rais Khan missing-field client snapshot fallback

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Implemented locally on 24 October 2026. The separate frontend data/adapter file is
`src/lib/rais-khan-client-snapshot.mjs`. It applies only to RM `raiskhan`, code `033705`,
for FY 2026-27 and the supplied prior FY 2025-26. Salesperson selections, other codes,
other RMs and unrelated years receive their original objects unchanged.

## Fields filled in the current local report

A read-only projection audit inspected the FY report and all April-September monthly/four-week
contexts: **31 contexts**. A recursive assertion verified that every original populated leaf,
including numeric zero, remained equal and all existing array rows/order were retained.

| Missing field | Frontend fallback |
| --- | --- |
| Territory expansion in the existing coverage disclosure | Deeper Chandigarh, Deeper Jalandhar, Deeper Amritsar |
| August Week 2 actual, weekly graph/tooltip | INR 3.11 lakh |
| August Week 2 actual-sales summary when that week is selected | INR 3.11 lakh |
| Missing thrust-product name | Acid Zinc Brighteners |
| Missing thrust-product name | Pretreatment Chemicals (Surfactants) |

The two added product cells retain unavailable sales and contribution in source data, displayed as blank metric areas in normal/live mode. Explicit Admin-only localhost **Demo Preview** may show separate labeled synthetic metrics without changing those source values. The ambiguous source `0.00`
is retained only as uninterpreted source data; it is never allocated to a product. Existing
product cells, their values and configuration order remain intact. Names are deduplicated.

Financial and chart fallbacks retain their snapshot provenance where shown. The Thrust Products card no longer displays Demo Preview, Demo, or Demo example labels. For FY 2026-27, missing monthly and four-week chart figures are filled with display-only sample values; existing populated values remain unchanged. Chart fallback fields are marked for provenance and are not invoices, CRM records, or AI evidence. The snapshot adapter creates no invoice or attendance records. Attendance demo explanatory copy and the Future / unverified legend item are hidden; see [finalization](rm-report-finalization.md) for the broader UI changes.

## Existing populated data preserved

- RM name/code, Ludhiana operating city, CRM territory identity, source/cutoff dates, supplied
  executive coverage and Sartaj Khan/Ludhiana technical-service details.
- Annual target **123.03 L**, target to financial cutoff **62.54 L**, actual **53.15 L**,
  previous comparable actual **63.33 L**, achievement **84.99%**, target gap and growth.
- All populated monthly targets, actuals, achievement calculations and variations; all valid
  zeros; original prior-year values; existing weekly amounts even when the new input differs.
- For example, existing May Week 2 **3.81 L**, June Week 2 **1.31 L** and July Week 2 **3.11 L**
  remain unchanged despite different newly supplied cells.
- CRM visits, leads, attendance, orders, requests, user relationships, invoices and raw APIs.
  Insights/actions keep the original verified report/summary, including in the PDF. Fallback
  values never run through financial formulas or AI recommendation generation.

The adapter also supplies missing matching identity/month/prior-year financial fields if a
future raw response genuinely lacks them. It fills supplied values only; it does not invent
derived percentages, growth, weekly targets, unreported actuals or annual totals from partial
data. Snapshot actuals require matching complete period dates by the September cutoff. The
September cumulative total is never used as October YTD or a complete prior-FY actual.

## Remaining source discrepancies

The user delegated the annual-unit decision. Annual fallback amounts use **INR lakh**, which
matches both the monthly schedule and the existing compiled source. The supplied **crores**
heading remains recorded as a discrepancy. Existing populated amounts were not rescaled.

| Source comparison | Values in INR lakh |
| --- | --- |
| Full-year monthly targets vs client annual target | 123.03 vs 123.00 |
| April-September monthly targets vs reported total | 62.54 vs 62.53 |
| April-September monthly actuals vs reported total | 53.15 vs 53.14 |
| Prior April-September monthly actuals vs reported total | 63.33 vs 63.34 |
| Supplied May weekly cells vs monthly actual | 17.28 vs 15.72 |
| Supplied August weekly cells vs monthly actual | 10.45 vs 7.34 |
| Supplied July variation vs actual minus target | -4.71 vs -4.72 |

Weekly cells additionally differ from some existing populated source cells, as noted above.
Reported integer achievement percentages can differ from existing calculated percentages.
All such existing values are retained. No balancing or proportional allocation is performed.
Future-month blanks and unprovided weekly cells stay unavailable. FY-wide weekly totals in
the client object are not incorrectly assigned as a selected month's weekly targets.

## Verification

- `CRM_BROWSER_TEST=1 node --test scripts/rais-khan-client-snapshot.test.mjs`: 6 passed,
  covering immutable preservation, zero priority, period boundaries, prior-year data,
  deduplication, other-RM exclusion and real local frontend/browser/PDF behavior.
- V4 regression suite: 5 passed. API product count still reflects the original configuration; its
  browser assertion allows the two separately labeled frontend-only names for Rais Khan.
- TypeScript and production build passed. The existing saved-input CSS Autoprefixer `end`
  warning remains nonblocking.
- Screenshots, the downloaded test PDF and the read-only audit JSON are under ignored
  `scratch/rais-client-snapshot/`. Browser screenshots use controlled API fixtures; the audit
  reads the active database using SQLite `readOnly:true`. No database writes, schema changes,
  commits, pushes or deployments are part of this change.

## Files

- `src/lib/rais-khan-client-snapshot.mjs` and `.d.mts` (new)
- `src/components/reports/client-snapshot-badge.tsx` (new)
- `src/components/admin/rm-performance-workspace.tsx`
- `src/components/reports/rm-performance-view.tsx`
- `src/components/reports/rm-performance-chart.tsx`
- `src/components/reports/rm-thrust-products.tsx`
- `src/components/reports/rm-performance-pdf.tsx`
- `src/components/reports/rm-performance-v4.css`
- `shared/rm-performance.d.mts`
- `scripts/rais-khan-client-snapshot.test.mjs` (new)
- `scripts/rm-performance-v4.test.mjs`
- `docs/operations/rais-khan-client-snapshot.md` (new)
