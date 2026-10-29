# RM Performance Report V2

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

> Latest source: [24 October current implementation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026),
> including [Rais Khan's missing-field snapshot fallback](rais-khan-client-snapshot.md).

> Current update (24 October 2026): [RM Report Card V4](rm-performance-v4.md) adds attendance and
> YTD thrust-product company contribution, and removes the visible availability/scope disclosure.

> Visual update (23 October 2026): [RM Report Card V3](rm-performance-v3.md) now provides the
> compact executive UI, grouped analysis, inline refresh and polished PDF. It retains this
> data model and corrects operational event filtering to the displayed source cutoff.
> The subsequent V3 manual-entry fix separates the saved-CRM activity window from the financial
> source cutoff so newer RM inputs remain visible in the selected reporting period.
> The 23 October header update removes the source-status strip; Rais Khan's RM identity displays
> code `033705`. See [current report-card changes](2026-10-21-current-state.md#rm-report-card-update--23-october-2026).
> The current saved-entry table displays a completed visit and its linked order,
> follow-up and generated lead in one row; uncompleted route plans remain on My Day.
> See [V3 saved-entry and thrust-product details](rm-performance-v3.md#current-compact-saved-entry-table).

Implemented locally on 23 October 2026. No commit, push or deployment was performed.

## Screen and navigation

The existing `/admin/team/[id]` and `/rm/report-card` entry points now open the V2 workspace.
The only time selector is Financial Year. Administrators retain the existing RM selection
capability; RM accounts receive only their own server-resolved identity.

The screen order is year selection, identity/coverage, performance summary, interactive
chart, customer engagement, detailed tables, data limitations, performance insights and
Manager Action Review. The duplicate report wrapper and Today/Week/Month/FYTD controls
are absent from this workspace. Unrelated CRM screens and V1 API behavior are unchanged.

The shared selection contains `financialYear`, `reportType`, `month`, `week` and `weekScheme`.
The range comes from the existing `rmReportPeriod` function. Changing year or RM clears
the drill-down. Clicking a month switches the report to that month; clicking a week
switches it to the exact bucket dates. Breadcrumbs return to month or full year.

The FY chart remains mounted while the active report changes. Its 12 April-March groups
compress horizontally over 400 ms and make room for the selected month's four groups.
Below 1100 px the charts stack. Mobile plots scroll locally instead of shrinking labels
until unreadable. Reduced motion disables transitions. SVG groups support keyboard focus,
Enter and Space; hover, focus and tap reveal the same performance detail panel.

The active report and the persistent FY overview are explicitly separate views of the same
normalized model. The FY chart remains a navigation overview, while KPIs, detail tables,
analysis and export use the active range. Request results are matched against RM identity,
year, range and report type; delayed responses cannot overwrite a newer selection.
Existing request deduplication and the 15-second client cache are reused.

## Data projection and source priority

Existing endpoints accept `reportVersion=2` in addition to the existing period parameters.
The V2 projection runs after the existing RM directory, authenticated scope, unique-profile
and subordinate resolution. Authentication and authorization are unchanged.

`server/rm-performance-report.mjs` builds `RmPerformanceReport`. It reuses the existing
authoritative-invoice predicate and signed invoice/line amount helpers. Credit notes remain
negative, staged imports are excluded, and sales are attributed by verified customer owner.
One grouped daily sales scan supplies FY buckets and comparable windows. Detail aggregates
use the same predicates, owner scope and active dates. V2 returns all matching detail rows;
the screen scrolls tables, and the PDF paginates them.

Financial source priority is stable for a selected FY:

1. Authoritative Tally invoices for that FY and verified RM/team.
2. Existing supplied PDF snapshot monthly/weekly aggregates when no live FY invoices exist.
   The snapshot's previous-year monthly aggregates also support the preceding FY.
3. Unavailable when neither source establishes actuals.

Source records are resolved by RM identity. There are no hardcoded Rais Khan financial
figures and no fabricated invoices, customers, visits, activities or demo rows in V2.
Operational details always come from CRM records; PDF aggregate sales are not assigned to
invented customer or product rows. The snapshot date and last Tally sync remain source
metadata in the report model. The shared RM identity header no longer displays their status
strip; source provenance and reporting cutoffs remain distinct in the report data.

Future actuals are null. A year with no authoritative invoice evidence is also null rather
than an assumed zero. Within an evidenced FY, a bucket without invoice rows means zero
recorded net sales; this does not prove complete Tally coverage. Returns can produce valid
negative bucket totals. Missing targets remain null; explicitly stored zero targets remain
zero, with percentage calculations unavailable because the denominator is zero.

## Four reporting weeks and targets

The existing source report supplies Week 1-4 aggregates without explicit date boundaries.
V2 uses the already documented four-bucket date allocation:

| Bucket | Dates |
| --- | --- |
| Week 1 | 1-7 |
| Week 2 | 8-14 |
| Week 3 | 15-21 |
| Week 4 | 22 through month-end |

Every date occurs exactly once, including leap day and days 29-31. The UI and PDF label this
as the adopted date rule, rather than claiming the source PDF established these boundaries.

Stored source weekly targets take priority and their blanks stay unavailable. Previous-year
monthly source data is never split into invented weekly figures. For live invoice reporting,
the database has monthly targets but no configured weekly target table. Those targets are
allocated by calendar-day counts using the existing prorating utility, with the cent-rounding
residual assigned to Week 4 so four allocated targets reconcile exactly to the stored month.
Targets are never blindly divided by four. Actual weekly sales use exact invoice dates.

Source PDF weekly values are preserved as supplied. Their rounding or missing achievements
can prevent reconciliation with monthly aggregates; V2 discloses that limitation and never
changes a source figure to force equality.

Client decision still required: confirm the four date buckets as the business convention.
If actual business boundaries or live weekly targets differ, provide those authoritative
definitions/records before replacing the documented allocation.

## Calculations and comparison windows

All calculations are in rupees before display formatting. Shared formulas are in
`shared/rm-performance.mjs`:

```text
Target variation   = Actual - Target
Variation %        = (Actual - Target) / Target * 100
Achievement %      = Actual / Target * 100
Growth %           = (Actual - Previous comparable actual) / Previous comparable actual * 100
```

Percentages round to two decimal places. A zero or unavailable denominator yields N/A.
Positive/negative variation has a sign and green/red presentation. Currency uses the
existing Indian rupee/lakh/crore formatter, preserving negative signs.

Current FY actuals and elapsed targets end at the cutoff; the annual target is shown
separately. Monthly and weekly targets cover their full selected bucket, while partial
actuals are explicitly identified. FY comparison uses the previous FY's same elapsed dates,
with February 29 clamped to February 28 where needed. Monthly comparison uses the previous
calendar month and comparable elapsed days, bounded by that month's end. Weekly comparison
uses the preceding reporting bucket and comparable elapsed days, bounded by that bucket's
end. Reporting buckets have unequal lengths, particularly Week 4. No daily sales are
fabricated from source monthly/weekly aggregates for a partial comparison.

## Insights and Manager Action Review

The same shared narrative array feeds the UI and PDF. Up to five categories are generated
from supported metrics: target achievement, momentum, engagement, visit productivity and
follow-up execution. Categories without reliable evidence are omitted. Recorded customer
contacts are reported without inventing uncontacted-assignment counts or causal explanations.

With a configured provider, `enrichPerformanceReview` in `server/rm-ai-analysis.mjs` supplies
the verified structured context to the existing provider. The model may reorder known
finding IDs only. Strict validation rejects unknown IDs, duplicates, omitted findings and
extra fields. It cannot rewrite figures or introduce unsupported prose, owners or deadlines.
The UI identifies this as AI-assisted prioritization. A bounded five-minute cache shares work.

Without a provider, or on a provider/validation failure, deterministic findings are shown
with an explicit rule-based label. A live external provider call was not needed for testing;
mock-provider tests check the constraint and fallback behavior.

Manager actions are vetted recommendations attached to those same evidence categories and
carry issue, evidence, priority and reason. Historical periods use a retrospective heading
and wording. No completed action is claimed without evidence.

## PDF behavior

`rm-report-pdf.tsx` dispatches V2 data to the new renderer while preserving legacy exports.
The PDF receives exactly the active report object: FY, month or week. Identity, dates,
summary, static chart, variation analysis, all returned detail rows, limitations, every
supported insight and manager review use that context. The filename contains report type
and dates.

The renderer measures content after fonts are ready, groups blocks into A4 portrait pages,
keeps section headings with following content, repeats headers/numbered footers and continues
long table text. It does not enforce a two-page limit or discard rows. Export refuses an
unpaginated or oversized block instead of silently clipping it. The existing canvas/jsPDF
download mechanism remains in use. Preview supports Escape, focus return and focus trapping.

## Verification

```powershell
$env:CRM_BROWSER_TEST="1"
node --test scripts/rm-performance-v2.test.mjs scripts/rm-dynamic-periods.test.mjs scripts/phase3-rm-report.test.mjs
npx tsc --noEmit
npm run build
```

The combined suite passed 14 checks. The obsolete V1 dropdown/fixed-two-page browser test
is explicitly retired because those interactions were replaced; its replacement is the V2
browser suite. A subsequent focused V2 run passed all six checks, including real downloads
for FY/month/week and a 90-row PDF, source-report coverage parity, reduced motion, responsive
layout, rapid-selection race protection and own-RM access. TypeScript and production build
passed. Syntax validation passed for the new backend projection.

Downloaded test PDFs were rendered with PyMuPDF and inspected visually. DOM checks verify
that no content crosses page footers. PDFs grow with content; there is no two-page cap.
Synthetic UI/PDF evidence is under `scratch/rm-v2/` and is not production business data.

A test-isolation import-order mistake briefly inserted synthetic fixtures into the local
development database. It was corrected to dynamically import database-dependent modules
after the temporary path is set, with a database-path assertion. Only the verified fixture
records were removed. All non-fixture business rows in the nine affected tables were checked
for exact equality against the pre-cleanup copy; unrelated records were preserved. The
temporary safety copy was then removed. Subsequent tests ran against isolated databases.

## Remaining data limitations

- Historical customer ownership/assignments are not versioned; reports use current verified
  ownership and disclose this limitation.
- Historical open/overdue follow-up and open-pipeline statuses cannot be reconstructed from
  current status fields, so historical metrics are unavailable rather than today's statuses
  mislabeled as old period facts.
- Visit completion at a historical cutoff requires a recorded completion timestamp. Current
  stored outcomes are explicitly labeled; missing timestamps do not prove past completion.
- Customer creation dates, complete contact-channel coverage, customer response delays and
  historical assignment lists are insufficient to establish acquisition or uncontacted counts.
- Tally sync time may be unavailable; invoice records do not establish complete source coverage.
- Source PDF data has aggregate granularity and rounding limits. It cannot establish customer,
  product or daily detail that was not supplied.

## Files changed for this implementation

Existing files updated:

- `server/admin.mjs`
- `server/rm-ai-analysis.mjs`
- `src/lib/api.ts`
- `src/components/admin/admin-rm-detail.tsx`
- `src/components/admin/rm-report-pdf.tsx`
- `scripts/rm-dynamic-periods.test.mjs`
- `docs/operations/rm-period-reports.md`

New files:

- `server/rm-performance-report.mjs`
- `shared/rm-performance.mjs`
- `shared/rm-performance.d.mts`
- `src/components/admin/rm-performance-workspace.tsx`
- `src/components/reports/rm-performance-chart.tsx`
- `src/components/reports/rm-performance-view.tsx`
- `src/components/reports/rm-performance-pdf.tsx`
- `src/components/reports/rm-performance.css`
- `scripts/rm-performance-v2.test.mjs`
- `docs/operations/rm-performance-v2.md`

The workspace already contained many unrelated changes before this implementation. They
were retained; the list above describes this task's source/documentation work only.
