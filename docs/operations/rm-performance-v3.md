# RM Report Card V3 — executive dashboard

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

> Latest source: [24 October current implementation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026),
> including [Rais Khan's missing-field snapshot fallback](rais-khan-client-snapshot.md).

> Current update (24 October 2026): [V4 attendance, thrust-product grid and UI cleanup](rm-performance-v4.md)
> adds the compact attendance view, verified YTD company contribution and removes the verbose
> availability/scope disclosure from the UI and active PDF. Earlier V3 observations below are dated evidence.

Implemented locally on 23 October 2026. This is a presentation refresh of the V2 reporting
model, plus a confirmed as-of filtering correction. No schema, authentication, invoice
attribution, signed-sales definition or financial formula was changed. No packages were
added, and nothing was committed, pushed or deployed.

## Assigned salesperson selection

The former Regional manager selector is replaced by **Salesperson** within the current RM's
report. It lists only active CRM salesperson accounts whose `manager_user_id` matches this
verified RM. **RM & full team** retains the aggregate view. If none are assigned, the control
is disabled with **No salespeople assigned**; source-PDF territory names do not create account
assignments. No assignment changes are made automatically.

Selecting a salesperson sends `salespersonId` to the existing version-2 admin/RM endpoints.
The server validates membership before projecting data, and scopes financial invoices,
products, customers, thrust products, visits, activities, follow-ups, orders, leads, requests
and attendance to that exact user. RM snapshots and RM target schedules are not reused for
individuals. Verified period-specific salesperson targets are not currently available, and
the inconsistent historical `monthly_target` units are not inferred.

The identity, annual/month/week chart, summaries, insights, saved entries and PDF all use
the selected scope. Cache keys and asynchronous response checks include salesperson identity;
changing person resets drill-down and closes PDF preview. The report retains parent RM
context and the assigned salesperson options. Other-RM, inactive and unknown selections are
rejected for both admin and RM access. The Rais Khan demo is unavailable for individual scopes.

Verification: TypeScript passed. Existing V3 regressions passed, and the new focused browser/API
check passed for signed invoice totals, isolated entries, denied selections, rapid switching,
month drill-down, responsive layout and PDF scope/footer clearance. Synthetic account assignments
and invoices used an isolated temporary database; actual CRM assignments were not changed.

## Saved RM My Day inputs — 23 October 2026

### Current compact saved-entry table

The **RM My Day · saved entries** table has exactly eight visible columns: Customer,
Purpose / Priority, Product Discussed, Visit Outcome / Tags, Expected Order Value / Date,
Next Follow-up Mode / Date, Discussion Notes, and Lead Pipeline. Its UI is
`src/components/reports/rm-my-day-inputs.tsx`, mounted by
`src/components/admin/rm-performance-workspace.tsx`. The report is assembled in
`server/rm-performance-report.mjs`; `server/rm-my-day-entries.mjs` reads and joins the
CRM records for the verified RM/team and selected CRM date range.

One completed visit produces one table row. Its linked expected order, selected
follow-up and current lead stage appear in that row; the lead created from that
visit is not repeated as another row. Planned and in-progress visits remain in
the RM's My Day route but do not claim a saved visit outcome in this table.
Independent orders, follow-ups, leads, activities and requests still appear as
their own entries. Links use stored visit IDs or an unambiguous customer lead;
matching customer names alone does not join records. The underlying business
records are not deleted by this display correction.

The current **Customer & business performance → Thrust Products** table is rendered
by `ThrustSummary` in `src/components/reports/rm-performance-view.tsx`.
`server/rm-performance-report.mjs` adds its report table using the scoped
`calculateThrustProductsForNames` function in `server/admin.mjs`; configured
product names come from the `thrust_products` database table. Unavailable
product-level sales remain unavailable rather than inferred from RM totals.

Focused validation on 23 October: `rm-my-day-entries.test.mjs` and
`visit-lead-pipeline.test.mjs` passed (3 tests); V2/V3 report regression suites
passed 10 tests with 3 optional browser/baseline checks skipped. The local Rais
Khan report projection returned one completed-visit row after the join fix.

Manual-entry visibility fix: financial and CRM activity windows are now explicit and separate.
For example, Rais Khan's 30 September financial snapshot no longer hides CRM records saved
on 22–23 October inside the selected financial year. `myDayRange` ends at the earlier of the
selected period end and today; `myDaySummary` drives the displayed visit/follow-up overview
cards. The original source-cutoff financial projection and analysis remain
intact. Historical current-status totals stay unavailable; future periods stay empty.

The duplicate field-operations panel (Visits & field activity / Follow-ups & opportunities)
was subsequently removed at the user's request. Operational details appear under **RM My Day ·
saved entries** only; the PDF likewise omits the older duplicate visit/follow-up/pipeline tables
when the full My Day entries are available. Overview KPI cards remain in place.

Actual saved entries are the default, including browsers with an old saved demo preference.
Demo is an explicit temporary preview, reset on context changes or changed saved records.
Visible actual reports refresh every 15 seconds and on focus/visibility return. Preview and
PDF modes pause that polling. Both annual and active report subscribers refresh, sharing
requests when their keys match. PDF pages disclose both financial and CRM dates.

Regression coverage saves a lead through the authenticated RM write endpoint in an isolated
database, checks RM/admin parity and other-RM isolation, waits for automatic admin refresh,
and confirms the new entry in the PDF without changing sales figures. The live local database
was inspected read-only; no actual business records were inserted or changed by this fix.

The admin RM report card and shared RM view now include a full-width **RM My Day · saved
entries** section. Category controls cover visits, calls/interactions, follow-ups, expected
orders, service requests, leads and attendance, with counts, text search and six-record
paging. Every returned record remains accessible. Flexible field rows fill the available
width without fixed card heights; notes wrap and mobile fields stack into two columns.

Saved details include discussed products, purpose, priority, outcome, discussion notes,
tags, scheduling/completion timestamps, follow-up mode/date, expected order value/date,
request details and responsible person, lead contact/company/source/next action fields,
and attendance times/GPS. Voice notes show whether a recording exists; private file paths
are not exposed. Unfilled fields say **Not recorded**.

`server/rm-my-day-report.mjs` reads only the already resolved RM/team user IDs and requires
the existing verified ownership mapping. Visits/attendance use business dates; other inputs
use creation/interaction dates in India. Saved inputs stop at the displayed CRM cutoff,
independently of the supplied-PDF financial cutoff. Future due/expected dates on in-period entries remain visible.
Completed follow-ups and closed orders remain in this input history. Their current stored
statuses/text are explicitly labeled and do not establish historical status or change the
existing historical KPI rules. Financial calculations are unchanged.

PDF export includes every saved entry and field, independent of on-screen category, search
or paging. Field blocks and long-note continuations paginate without wide multi-column
tables. TypeScript and the V3 suite passed (three tests passed, optional baseline capture
skipped), including desktop/mobile layout, scope/date isolation, search/paging, PDF field
retention and footer clearance. QA fixtures use an isolated temporary database. Screenshots:
`scratch/rm-v3/my-day-inputs-{1440,1024,768,390}.png`.

## Rais Khan demo inputs

At the user's request, Rais Khan's shared admin/RM report card offers seven complete fictional
entries in each My Day category (49 total). **Show demo entries** opens the clearly
labeled preview and a shortcut near the report header. **Show actual entries** switches back
to the unchanged API data. Actual entries are the default on a new page load. Other managers never
receive this preview. Future periods have no synthetic entries.

The generator in `shared/rais-khan-my-day-demo.mjs` creates presentation-only examples with
all fields populated. Example contacts use `example.test` addresses and dummy phone labels;
voice-note entries explicitly identify a placeholder with no audio. No demo rows are inserted
into the database or used in financial charts, KPIs, insights or manager recommendations.
PDF export follows the active input mode, marks every page **DEMO INPUTS**, and retains the
real financial source. Demo categories show all seven entries together.

## Header and code update — 23 October 2026

The RM report-card header omits the supplied-PDF snapshot date, Tally sync availability and
financial-year status strip. Rais Khan's verified RM identity displays code `033705`; the
code is not applied to other RMs or salesperson selections. See the [current implementation
record](2026-10-21-current-state.md#rm-report-card-update--23-october-2026).

## What changed

- One compact header combines RM identity, city/region, FY and salesperson selection,
  Download PDF and inline Refresh Data.
- Current verified assignments and supplied-PDF territory mappings remain distinct. An
  accessible coverage disclosure preserves every executive, territory and technical-service
  entry without expanding the default header.
- Exactly eight KPI cards form two four-column desktop rows. Tablet/mobile use two columns.
  Active-customer counts moved into customer analysis, avoiding an orphan ninth card.
- The chart preserves FY → month → four reporting weeks, keyboard/touch selection, signed
  actuals, target highlighting, variation and comparison details, reset and reduced motion.
  Responsive SVG dimensions keep labels readable during compression. Missing values have
  missing bars and a legend rather than dozens of repeated N/A labels.
- The chart's detail panel is a compact metric row. Reporting-week convention, target basis
  and comparison scope are accessible in a disclosure. Async updates preserve occupied
  space while clearly marking previous-context content unavailable until the new result arrives.
- Customer/engagement and product/thrust analysis share two columns. Field activity and
  follow-ups/pipeline share another pair. Short empty messages replace separate empty cards.
- Tables show a useful initial record window with Show All controls; all records remain
  accessible. Numeric columns align right. Invoice detail is expandable instead of occupying
  the main view by default. There are no nested vertical table scroll regions.
- When all thrust sales are unavailable, configured names appear once as compact labels;
  a single explanation replaces repeated N/A rows.
- One expandable Data Availability section exposes omitted, incomplete and unavailable detail,
  together with the existing source/ownership/status limitations.
- Five insight categories use balanced responsive cards. Supported categories have exactly
  two evidence points. Unsupported categories have one explicit limitation. Rule-based versus
  AI-assisted provenance remains visible.
- Manager Action Review is an evidence/priority/response matrix. It uses the five requested
  management categories, with two supported responses per available category. Historical
  responses are retrospective, no actions are claimed completed, and a fully completed visit
  plan does not generate advice about nonexistent outstanding visits.

The PSSPL navigation sidebar and global header retain their original appearance. The global
floating refresh control is suppressed only on the two report routes because the same
refresh component now appears inline. Other routes retain their existing floating control.

## Confirmed cutoff defect and correction

Previously, a supplied FY financial snapshot could end on 30 September while CRM activity
queries continued through today's date. The normalized report then displayed the September
cutoff alongside October visits and calls.

All period-detail queries now end at the report's displayed `asOf`, including visit dates,
completion timestamps, calls, contacts, invoice/product/customer detail, dormant analysis,
team sales and thrust-product evaluation. Records beyond that date are excluded from the
historical view and its counts. Underlying records are not changed or deleted.

If `asOf` is earlier than today, current follow-up and pipeline status cannot establish their
historical state. Those metrics remain unavailable, even when the selected FY is ongoing.
A visit marked completed today is not presented as completed at an earlier cutoff without
a supporting timestamp. Late or undated completion displays **Completion at cutoff unverified**.

Source-PDF monthly comparison metadata also names the full previous calendar month actually
supplied, instead of labeling that full-month aggregate as a partial daily window. This
corrects the label/date scope without changing the supplied amounts or growth calculation.

The regression fixture includes a September visit and call, an October planned visit and
call, and a September visit completed in October. It verifies cutoff filtering, completion
counts, explicit unverified status, unchanged future records, and unchanged financial totals.

## Refresh and asynchronous behavior

The existing refresh event, route refresh, pending feedback and loader errors are retained.
A delayed refresh from a previous context could previously update component state after
the selected period changed. `use-admin-data.ts` now checks whether that refresh subscription
is still active before applying its result/error. The request cache remains reusable.

Browser coverage includes normal refresh, a simulated refresh failure, successful retry,
and a delayed FY refresh followed by selecting September. The later selection remains active.

## PDF

The PDF shares the same eight KPIs, insight evidence and manager response templates with the
dashboard, and receives the exact active FY/month/week model. It uses compact fixed-width A4
document styling rather than copying the responsive web grid.

Empty tables are consolidated in an availability note. Unavailable thrust sales show all
configured product names once. Populated tables retain every returned row, with headers
repeated when the table continues on a new page. Long cells continue without truncation.
Five-category insight and manager-review sections stay together with their headings.

Pagination measures actual header/footer and content dimensions after fonts load. It reserves
footer clearance, reports oversized blocks instead of clipping them, and does not force a
two-page limit. The existing canvas/jsPDF download path is retained.

FY, month and week PDFs were downloaded, rendered with PyMuPDF and visually inspected across
all pages. DOM checks also verify footer clearance. The reference source report uses three
pages for each context; page counts vary with available detail.

## Visual evidence

Screenshots were captured before changes and after iteration using the actual local React
application with an isolated test database. Financial aggregates come from the existing
Rais Khan source snapshot; the minimal CRM records are synthetic QA fixtures, not production
customer activity.

At 1440px, the reference full-page height decreased from **5,670px to 2,863px**, approximately
**49.5% shorter**, while retaining data access. Desktop header height is approximately 176px,
including source metadata and collapsed coverage access.

| Viewport | KPI columns | Viewport overflow |
| --- | --- | --- |
| 1920 × 1080 | 4 | None |
| 1440 × 900 | 4 | None |
| 1366 × 768 | 4 | None |
| 1024 × 768 | 2 | None |
| 768 × 1024 | 2 | None |
| 390 × 844 | 2 | None |

Evidence is under `scratch/rm-v3/`:

- `baseline-*.png`: pre-change screenshots at all six sizes.
- `executive-*.png`: final responsive views.
- `expanded-month.png` and `week-context.png`: drill-down contexts.
- `rich-data.png`: populated customer/product/invoice detail and record expansion.
- `year.pdf`, `month.pdf`, `week.pdf`: synthetic-context export evidence.
- `responsive-audit.json`, `pdf-audit.json`: measured layout and pagination checks.

The reference PDFs and screenshots are QA artifacts; they are not client production reports.

## Verification

```powershell
$env:CRM_BROWSER_TEST="1"
node --test scripts/rm-performance-v3.test.mjs scripts/rm-performance-v2.test.mjs scripts/rm-dynamic-periods.test.mjs scripts/phase3-rm-report.test.mjs
npm run build
npx tsc --noEmit
```

The combined suite passed 16 checks, including the V2 data/permission/drill-down/PDF
regressions and the V3 layout, cutoff, refresh, accessibility and responsive checks.
Two tests are intentionally skipped: the retired V1 dropdown/fixed-two-page browser flow,
and the opt-in pre-change baseline capture. The baseline was executed before implementation.

TypeScript and production build passed. A OneDrive `readlink` error in the generated
`.next-runtime` cache initially blocked the build. That generated directory was preserved
under a timestamped backup name, then regenerated. Build and type checks were run sequentially
afterward. Existing Autoprefixer warnings in unrelated archive/team-structure styles were
left unchanged.

All fixture writes run in a temporary database. Database-dependent imports occur only after
the temporary path is configured, and tests assert the actual SQLite path before seeding.

## Files changed for V3

- `src/components/admin/rm-performance-workspace.tsx`
- `src/components/common/refresh-data-button.tsx`
- `src/components/reports/rm-performance-view.tsx`
- `src/components/reports/rm-performance-chart.tsx`
- `src/components/reports/rm-performance-pdf.tsx`
- `src/components/reports/rm-performance.css`
- `src/lib/rm-executive-review.ts` (new)
- `src/lib/use-admin-data.ts`
- `shared/rm-performance.mjs`
- `server/rm-performance-report.mjs`
- `scripts/rm-performance-v2.test.mjs`
- `scripts/rm-performance-v3.test.mjs` (new)
- `docs/operations/rm-performance-v3.md` (new)
- `docs/operations/rm-performance-v2.md`
- `docs/operations/rm-period-reports.md`

## Retained limitations

Historical customer ownership is not versioned. Complete customer-contact coverage and
customer creation dates remain unavailable. Historical open/overdue follow-up and pipeline
states cannot be reconstructed. PDF source aggregates cannot establish missing invoice,
customer, product or daily detail. Missing financial values remain unavailable, not assumed
zero. The adopted four-week date convention still needs client confirmation as documented
in V2; this visual redesign does not change it.
