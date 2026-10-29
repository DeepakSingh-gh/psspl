# RM Report Card V4 - attendance and thrust products

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

> Subsequent update (24 October 2026): [Rais Khan missing-field client snapshot](rais-khan-client-snapshot.md)
> adds only labeled frontend fallback fields for code 033705. Existing values, valid zeros,
> attendance and calculations retain priority. The original V4 evidence below describes its implementation run.

Implemented locally on 24 October 2026 for `/admin/team/raiskhan?fy=2026-27` and the shared
`/rm/report-card` workspace. No schema/dependency changes, production writes, commits,
pushes or deployments are part of this update. Existing unrelated local changes are retained.

## Attendance source and scope

`server/rm-report-v4.mjs` reads the existing `attendance` table through the existing authorized
V2 report resolver. Identity is the unique active RM CRM account, never a PDF coverage name.
Aggregate RM reports read **only the RM's own attendance**, not subordinate attendance. When
the existing salesperson selector is used, attendance explicitly becomes **Salesperson Attendance**
and reads that verified subordinate's account only. No raw account/session identifiers, GPS,
tokens or device logs are returned by this new attendance projection.

The current database enforces `UNIQUE(user_id, business_date)` and supports one daily session.
The projection retains the stored business date and check-in/out timestamps. SQLite timestamps
without an offset are interpreted as UTC; display and date boundaries use Asia/Kolkata.
Session IDs are used internally to deduplicate inputs. The shared calculation also supports
multiple disjoint sessions if the source later supports them, summing interval unions rather
than earliest-in to latest-out. Overlapping intervals count once. Invalid intervals and missing
clock-outs do not contribute hours. Overnight pairs retain their real dates and duration.

One FY attendance payload supplies all twelve months, independent of the financial PDF cutoff.
Its explicit **CRM through** date is the earlier of today and FY end. No attendance-month API
request is needed. The default is the latest recorded month within the cutoff, falling back
to the cutoff month (or first month for a future FY). A workspace month state follows chart
month/week changes; local attendance arrows update only that state. Returning to FY retains
the chosen month. Scope/FY changes reset it. Week selection highlights its matching block.

The current overview uses a GitHub-style full-FY April–March heatmap with all seven weekday names, all 365/366 dates and correct calendar alignment. Narrow views scroll horizontally without overflowing the page. Tooltips and the detailed attendance sheet retain the same normalized dates/sessions. PDF uses two static rows of six months; the former four-block month overview is superseded.

### Status and policy rules

- Green: a valid stored clock-in for that India business date. Missing clock-out is explicitly
  incomplete; a Sunday clock-in is retained and labeled **Worked on holiday**.
- Grey: Sunday holiday, centrally configured in `ATTENDANCE_POLICY`. No leave or holiday
  approval records are invented.
- Red: supported only for a completed date with verified employment, schedule and source
  coverage under an approved absence policy. The current CRM does not record these inputs,
  so production missing check-ins are **Unverified**, not red absences.
- Upcoming/beyond-cutoff dates remain neutral. Missing/unmapped source data remains unavailable.
- Present counts are recorded days, including worked holidays. Ordinary attendance percentage
  excludes holidays and requires a verified eligible working-day denominator; it is currently
  **N/A**, as are verified Absent Days and Eligible Working Days. Account creation is not
  treated as an employment start date. Punctuality and early departure are not inferred.

The native modal detail sheet provides RM/person name, code, month/range, cutoff, summaries,
recorded hours, incomplete count and a sortable daily table. Times include dates and AM/PM.
It supports keyboard focus containment, Escape, Close and a single scrolling table region.
Overview, details and PDF summaries use the same server-calculated monthly data.

## Thrust products and contribution

The existing vertical thrust table is replaced, without a duplicate section, by three equal
desktop columns, two tablet columns and one mobile column. All active configured products
are shown in configured order, with their exact names and no fixed product-count limit.
Each cell shows **YTD Sales** in INR lakh and **Company Contribution** to two decimal places.

Product configuration and alias matching reuse `calculateThrustProductsForNames`. Product net
sales use `tally_invoice_lines` joined to authoritative `tally_invoices` and current customer
`owner_user_id` in the verified report scope. Aggregate scope remains the RM and assigned
team; selecting a salesperson uses that person alone. Company-wide product totals are never
substituted for that scoped numerator.

The company denominator is a read-only sum of all authoritative invoice net amounts for
the **same FY start and active financial cutoff**, including customers outside this RM.
It uses the same `authoritativeInvoiceWhere`, `netInvoiceAmount` and `netInvoiceLineAmount`
rules as existing reporting: staged/Excel-import records are excluded and credit notes/sales
returns reduce sales. YTD remains explicitly YTD when the chart selects a month or week.

`Company Contribution % = scoped product YTD net sales / company-wide YTD net sales * 100`.
Ratios use full precision; only presentation rounds. Signed product sales/percentages are
preserved. Verified zero product sales with a positive denominator produce 0.00%. Missing
invoices/lines and nonpositive or unavailable denominators remain unavailable in source data; thrust metric areas are visually blank with accessible unavailable text.

There is no verified tenant/company selector in this report. To avoid mixing accounting
companies, calculations require a single nonblank company identity in the authoritative
YTD invoices; multiple/unknown company scope leaves real contribution unavailable. An RM with no invoice evidence
or any scoped invoice missing all line items does not receive fabricated zero product sales.
Missing/nonnumeric invoice or line amounts are treated as incomplete evidence, not zero.
Configured categories may overlap and must not be summed as distinct sales. Invoice evidence
does not establish complete external Tally coverage. The aggregate company amount is exposed
only to an administrator; authorized RM responses retain percentages without company details.

## UI removal and PDF

The **Data availability & reporting scope** disclosure, its subsections, wrapper and unused
styles are removed from the visible report. The API's validation, limitations and provenance
metadata are retained. Compact source/cutoff provenance remains; the verbose thrust missing-source/formula paragraph is removed, and missing thrust metrics are blank.
The old lengthy availability/scope blocks are also removed from the active V2 PDF.

`src/components/admin/rm-report-pdf.tsx` remains the existing export entry point and delegates
version-2 documents to `rm-performance-pdf.tsx`. The current document exports full-FY attendance in FY/month/week contexts, plus the selected monthly attendance summary and matching drill-down chart. Shared thrust cells, all saved entries, AI Insights and Manager Action Plan match the UI. A4 pagination is measured without a fixed page-count cap. The original finalization fixture generated 13-page PDFs before the later compact saved-entry table and pagination refinements; that count and the earlier four-page V4 result are historical. Current UI/PDF ordering puts Manager Action Plan before KPIs, uses four product columns in PDF, exports saved entries in eight columns and omits the old supporting appendix. Complete cards/rows are paginated using the final A4 page styles, with footer/continuation space reserved and an odd final insight using the full row. Current fixture-specific results are recorded in finalization; there is no fixed page-count cap. See [final evidence](rm-report-finalization.md#pdf-output).

## Validation and evidence — initial V4 run

- `CRM_BROWSER_TEST=1 node --test scripts/rm-performance-v4.test.mjs`: 5 tests passed, including
  pure calendar/session rules, isolated authenticated API calculations/permissions, dynamic
  19-product layout, real browser interaction and an actual downloaded PDF.
- `node --test scripts/rm-performance-v2.test.mjs`: 5 passed; its optional legacy browser case
  skipped. Financial formulas, FY/month/week, signed values, missing targets and deterministic
  AI findings retain their behavior.
- Focused V3 `financial-cutoff|salesperson selector` run with browser enabled: 2 passed,
  covering saved-data windows and salesperson scope/races/PDF.
- TypeScript and production build passed. The build reports an existing Autoprefixer `end`
  compatibility warning in the saved-input CSS; it does not prevent the build.
- All synthetic accounts, invoices and attendance lived in isolated temporary SQLite databases.
  API read tests compare attendance rows before/after. Active business records were not seeded
  or changed. Browser pages use the actual local UI with authenticated isolated-fixture API data.
- A final read-only active-database inspection found one verified Rais Khan RM account, two
  recorded FY attendance days and one authoritative YTD company identity. Both localhost
  frontend and API health returned HTTP 200.

Evidence under ignored `scratch/rm-v4/`: `attendance-{1440,1024,390}.png`,
`attendance-details-{desktop,mobile}.png`, `thrust-{1440,1024,390}.png`, `audit.json`,
`rm-v4.pdf` and `pdf-render-01.png` through `pdf-render-04.png`.

## Exact implementation files

- `server/admin.mjs`
- `server/rm-performance-report.mjs`
- `server/rm-report-v4.mjs` (new)
- `shared/rm-attendance.mjs` (new)
- `shared/rm-attendance.d.mts` (new)
- `shared/rm-performance.d.mts`
- `src/components/admin/rm-performance-workspace.tsx`
- `src/components/reports/rm-attendance.tsx` (new)
- `src/components/reports/rm-thrust-products.tsx` (new)
- `src/components/reports/rm-performance-view.tsx`
- `src/components/reports/rm-performance-pdf.tsx`
- `src/components/reports/rm-performance.css`
- `src/components/reports/rm-performance-v4.css` (new)
- `scripts/rm-performance-v4.test.mjs` (new)
- `docs/operations/rm-performance-v4.md` (new)
- `docs/operations/rm-performance-v3.md`
- `docs/operations/rm-performance-v2.md`
