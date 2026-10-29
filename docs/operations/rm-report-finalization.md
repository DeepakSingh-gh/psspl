# RM Report Card finalization — 24 October 2026

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Implemented locally for the existing V2/V3/V4 report workspace. No commit, push or deployment was performed. Existing unrelated uncommitted changes were preserved.

## Attendance preview

The toolbar offers **Start Demo Preview** only after the existing authentication endpoint confirms an Admin, in the Admin workspace on localhost/loopback. It is off by default, is not stored in a URL or browser storage, and resets when the RM, salesperson or FY changes. Salesperson and RM self-service views cannot enable it. Leaving preview restores the original report.

`localReportPreview` creates a new presentation object from a stable hash of RM ID, FY, fixture version and date/product ID. It never mutates the input or persists records. Attendance covers April–March, including leap days, with varied working-day attendance, realistic India-time sessions and occasional missing clock-outs. Sundays remain holidays. Synthetic future dates have dashed borders and explicit tooltip labels. The existing attendance normalizer supplies monthly counts and percentages under an explicitly synthetic policy; the real absence policy is unchanged.

The overview, tooltip, detailed sheet and PDF use this same fixture. **Demo Attendance** appears beside the attendance heading. Financial KPIs, saved entries and AI evidence continue to use the existing report data. Automatic refresh pauses during the explicit preview/export session.

## Current report order and graph legends

The main RM Report Card and its PDF now use this order: RM identity/header and FY toolbar, **Manager Action Plan**, Performance Overview, Yearly Sales vs Target, selected month/week chart where applicable, Attendance, Thrust Products, **RM Save Entries**, then **AI Insights**. The separate **Actual sales / invoice detail** accordion is no longer shown. The existing Action Plan component is moved, with no duplicate at the bottom. AI Insights keeps its position after saved entries. Selected-period synchronization, priority calculation, vetted wording and provider integration are unchanged.

The shared sales-chart legend keeps its existing colors and Target label. Actual has `(<100%)` on a smaller second line; Target met has `(≥100%)` on a smaller second line. This applies to interactive charts and static PDF charts. Bars, calculations, tooltips, animations and FY-to-month-to-week drill-down are unchanged.

## Complete attendance matrices

The shared interactive/static heatmap renders at least five calendar-week columns and seven Monday-to-Sunday rows per month; months that require six columns keep six. Positions before/after real dates contain decorative `#E5E7EB` squares with the same dimensions, radius and gaps as real cells. They have no attendance record, status, tooltip, keyboard focus or click action and never enter totals or the detailed sheet. Every real date keeps its weekday and appears once, including leap days. Present `#16A34A`, absent `#DC2626`, Sunday/holiday `#9CA3AF` and future/unverified handling remain unchanged.

Only numerical main-UI summary values are colored: Present green `#16A34A`, Absent red `#DC2626`, Attendance percentage blue `#0284C7`. Missing `N/A` values and Holidays keep their existing styling. PDF summary styling is unchanged. Static PDF calendars now include the same leading/trailing fillers and five/six-column positioning; A4 retains two rows of six months.

## UI and thrust products

- Removed only the visible **Customer & business performance** heading and its excess spacing; product and invoice content remains.
- Removed the verbose missing-source/formula explanation from the thrust card and the old client-snapshot banner.
- Retained compact **Demo Preview** provenance, including field badges and PDF headers.
- Renamed **RM My Day · saved entries** to **RM Save Entries**, **AI Performance Insights** to **AI Insights**, and **Manager Action Review** to **Manager Action Plan**.
- Removed the saved-entry “Showing X–Y of Z entries” text. Page size, filtering, records and Previous/Next controls remain unchanged.
- Scoped Download PDF hover to dark primary `#06476a` with white text. Its normal, loading, disabled and focus behavior remains.

The product grid uses **four equal-width columns on desktop**, with the existing two-column tablet and one-column mobile behavior. PDF preview/download always use four columns, grouping complete rows of up to four cards; the final partial row preserves product order. Long names wrap using the existing card styles. All 17 products in the scoped fixture were checked without clipping, reordering or changed card content, values, colors or badges.

The thrust adapter preserves original product IDs, names, real sales, verified percentages and valid zero values. Only missing metrics receive a separate demo pair. Both-missing products display that pair; partially populated products retain their real metric and blank missing metric. Sample product values may appear without a Demo label in the Thrust Products card. Synthetic pairs use the existing contribution formula and company-wide YTD denominator. Unavailable live metrics are visually blank with accessible unavailable text, rather than N/A or fabricated zero.

The existing Rais Khan client snapshot fallback retains its original missing-only behavior, source discrepancies and zero preservation. This change shortens its provenance display; it does not reconcile or replace source figures.

## AI verification and limits

The active report uses `server/rm-ai-analysis.mjs::enrichPerformanceReview` through the existing provider transport. The configured provider is Claude, with credentials supplied by the existing environment; no credential was printed. Neither backend prompt, provider implementation, model selection nor configuration was changed.

Exactly **one live provider request** verified Rais Khan's FY 2026–27 report using read-only source data. It returned `analysisMethod: ai-assisted`, preserved all verified metrics and retained all four supported findings. Evidence is recorded in [live-ai-verification.json](../../scratch/rm-report-finalization/live-ai-verification.json).

The current V2 LLM prioritizes finding IDs. Insight and action wording comes from the existing vetted presentation templates; neither section is unrestricted LLM-generated prose. The UI/PDF accurately distinguish **AI-assisted priority** from **Rule-based findings**. Five categories remain visible; unavailable categories are not fabricated to satisfy a count. Two subpoints remain where supported by evidence.

RM-specific facts and cache isolation are verified. **The existing V2 provider payload does not explicitly contain the RM name/ID.** It contains RM-scoped verified facts, period label, dates, cutoff, historical flag, source, summary, KPIs and findings. This limitation was documented instead of changing the restricted pipeline. The separate legacy prose-generation flow is not the active workspace path.

FY/month/week payload accuracy, RM cache separation, cached reuse, unsupported responses, provider errors and configuration-disabled fallback were verified with isolated provider stubs. Only the FY context was sent in the one live Claude request. Historical wording and current-period responses retain their existing templates. Synthetic attendance/product metrics never become AI evidence.

## PDF output

The export receives the same prepared report object as the dashboard, waits for the active scope and disables export during loading/errors. Changing reporting context closes the preview. Each export includes the full selected FY attendance, even when sales are drilled into a month or week.

The shared calendar renders as two rows of six months on A4, retaining readable squares, all weekdays, colors, future-demo markings and a compact legend. Static rendering creates no tooltip portal. Monthly summary selection matches the UI. Section order follows the current ordering above, with Manager Action Plan immediately after identity/coverage. The former Supporting report detail / Variation analysis appendix and its additional tables are no longer appended. No page is discarded by page number, and there is no fixed four- or five-page limit.

The complete saved-entry set is exported, independent of the current UI search or page window. PDF uses the same eight-column order as the screen: Customer; Purpose / Priority; Product Discussed; Visit Outcome / Tags; Expected Order Value / Date; Next Follow-up Mode / Date; Discussion Notes; Lead Pipeline. Zero values, selected-period records and full long notes are preserved. Column headings repeat after page breaks; long text continues without silent truncation. Screen search and Previous/Next behavior are unchanged.

PDF measurement now uses the same A4 page class, content width and list styling as the final pages. Previously, unstyled measurement lists overestimated insight rows by about 28 px and action items by 12 px in the scoped fixture, causing early page breaks. `rm-pdf-pagination.ts` uses measured fractional heights, reserves continuation-heading height, keeps section headings with their first content block and refuses oversized atomic blocks instead of clipping them. Complete product rows, KPI groups, insight cards and action items remain intact. Adjacent insight cards pair when they fit; a smaller first card can use remaining page space when its taller neighbor cannot. An odd final insight uses the full row width. Continuation labels for products, insights and actions are compact. Fonts, page dimensions, colors and report text are preserved.

Preview and download still share the same paginated document. The existing downloader captures each `[data-rm-report-page]` with html2canvas at scale 2 and places its image on an A4 jsPDF page. No new PDF library or separate export layout was introduced.

At the original finalization checkpoint, the fixture with 25 saved entries and unusually long notes generated **13 A4 pages** in each context. That is historical test evidence from before the compact saved-entry table and subsequent grid/pagination refinements, not the current page count or a claim about Rais Khan's real records. Current page count depends on report content. The later pagination stress fixture produced FY 7 to 6 pages and month/week 7 pages; after moving the Action Plan, the separate compact fixture with no saved rows produced FY 3 pages and month/week 4 pages. These are different fixtures and must not be compared as the same report.

## Subsequent refinement verification - 24 October 2026

These results were recorded during the scoped implementation tasks; this Markdown synchronization does not rerun the application tests, contact a provider or establish a new release.

| Check | Recorded result | Local evidence |
| --- | --- | --- |
| Attendance matrix regression | 365/366 real dates; correct weekday alignment, fillers, tooltip/detail/FY behavior; desktop/tablet/mobile checks passed | `scratch/rm-attendance-heatmap/`, `scratch/rm-attendance-matrix/` |
| PDF attendance parity | All 12 months; 69 fillers for FY 2026-27; downloaded-cell color sampling passed; no added pages in that fixture | `scratch/rm-attendance-pdf-matrix/` |
| Saved-entry export | Eight columns, all 25 fixture entries, complete long notes and continuation headings; other report blocks preserved | `scratch/verify-saved-entries-pdf.mjs` |
| Four-column thrust grid | All 17 fixture products retained; desktop 4/tablet 2/mobile 1; PDF always 4; actual download and page bounds passed | `scratch/thrust-four-columns/` |
| Pagination unit tests | 8 passed: fitting/fractional heights, headings, row integrity, pairing, odd cards, reading order and overflow | `scripts/rm-pdf-pagination.test.mjs` |
| Pagination browser/download tests | FY/month/week, long descriptions, before/after content preservation; 0/1/5/33-product cases; no complete next block unnecessarily pushed off a page | `scratch/pdf-pagination-layout/`, `scratch/pdf-pagination-variants.test.mjs` |
| Action Plan and chart legend | FY/month/week order, one Action Plan, unchanged insights/actions/KPIs/calendar/products/bar heights/colors; two-line legend and actual download checks passed | `scratch/top-actions-legend.test.mjs`, `scratch/top-actions-legend/` |
| TypeScript and production build | Passed after the final Action Plan/legend change. Build used a fresh temporary copy outside OneDrive; existing Autoprefixer warnings remain | Scoped implementation session; no deployment |

Current source entry points: `src/components/admin/rm-performance-workspace.tsx` (single moved Action Plan), `src/components/reports/rm-performance-chart.tsx` (shared legend), `rm-performance-pdf.tsx` (PDF order, rows and measurement), `rm-pdf-pagination.ts` (PDF-only pagination), `rm-performance-v4.css` (thrust grid), and the existing attendance components. The pagination helper has a focused regression suite at `scripts/rm-pdf-pagination.test.mjs`.

Before/after PDF screenshots: [FY before](../../scratch/pdf-pagination-layout/fy-before-contact.png), [FY after](../../scratch/pdf-pagination-layout/fy-after-contact.png), [month after](../../scratch/pdf-pagination-layout/month-after-contact.png), [week after](../../scratch/pdf-pagination-layout/week-after-contact.png). Latest reordered downloaded reports: [FY](../../scratch/top-actions-legend/fy.pdf), [month](../../scratch/top-actions-legend/month.pdf), [week](../../scratch/top-actions-legend/week.pdf); [FY rendered pages](../../scratch/top-actions-legend/fy-downloaded-contact.png).

All refinements were local. No backend API, database, business calculation, AI prompt, credential, permission or other CRM page was changed by these presentation tasks. Existing uncommitted work was preserved; no commit, push or deployment was performed.

## Verification results

The following counts and build-cache handling belong to the **original finalization checkpoint**, before the later presentation changes described above. They are retained as historical evidence, not reported as a fresh full-suite run.

TypeScript `npx tsc --noEmit`: passed. Production `npm run build`: passed. The first build encountered a OneDrive `readlink EINVAL` in the old build output; that cache was preserved as `.next-runtime-finalization-backup-20261024`, followed by a successful clean build and successful final build. Existing Autoprefixer warnings about `start`/`end` alignment remain; no unrelated CSS was changed to suppress them. The generated `next-env.d.ts` reference was restored to its exact pre-task state.

**30 tests passed, 5 optional legacy browser/baseline cases skipped, 0 failures**, across these runs:

| Test file | Passed | Skipped |
| --- | ---: | ---: |
| `scripts/rm-report-finalization.test.mjs` | 6 | 0 |
| `scripts/rm-report-ai-verification.test.mjs` | 1 | 0 |
| `scripts/rm-performance-v2.test.mjs` | 5 | 1 |
| `scripts/claude-provider.test.mjs` | 1 | 0 |
| `scripts/rm-performance-v4.test.mjs` | 4 | 1 |
| `scripts/rm-monthly-chart.test.mjs` | 3 | 0 |
| `scripts/rais-khan-client-snapshot.test.mjs` | 5 | 1 |
| `scripts/rm-performance-v3.test.mjs` | 5 | 2 |

The finalization suite was run for the integrated demo/export case and separately for its added live/leap/permission regression. Browser checks covered 1440/1024/390 widths, zero preservation, visually blank missing values, 365/366 dates, deterministic re-entry, matching tooltip/detail sessions, demo scope resets, salesperson restrictions, live RM self-service isolation, graph keyboard drill-down and variation tooltips, reduced motion, pagination, refresh error/retry and export disablement. Browser errors were empty. Mocked report traffic contained GET requests only and no demo API parameters. Backend tests additionally verify authenticated ownership, signed sales and unchanged source calculations.

Source/config hashes captured before implementation confirm that backend files, credentials, dependencies and unrelated source files were unchanged by this task. The live AI verification opened the active database read-only; all write-capable automated tests used isolated fixture databases. No synthetic attendance, sales, product, saved-entry or employee record was written to the active database.

Full CRM-wide UAT and additional paid month/week LLM calls were not performed. The scoped browser checks and authenticated API regression tests above are the verification boundary.

## Original finalization artifacts

- [Baseline screenshot](../../scratch/rm-report-finalization/baseline-desktop.png)
- [Attendance desktop](../../scratch/rm-report-finalization/demo-attendance-1440.png), [tablet](../../scratch/rm-report-finalization/demo-attendance-1024.png), [mobile](../../scratch/rm-report-finalization/demo-attendance-390.png), [detail sheet](../../scratch/rm-report-finalization/demo-detail.png)
- [Thrust desktop](../../scratch/rm-report-finalization/demo-products-1440.png), [tablet](../../scratch/rm-report-finalization/demo-products-1024.png), [mobile](../../scratch/rm-report-finalization/demo-products-390.png)
- [FY PDF](../../scratch/rm-report-finalization/fy-demo.pdf), [month PDF](../../scratch/rm-report-finalization/month-demo.pdf), [week PDF](../../scratch/rm-report-finalization/week-demo.pdf)
- [Rendered PDF contact sheet](../../scratch/rm-report-finalization/pdf-contact-sheet.png), [PDF page metadata](../../scratch/rm-report-finalization/pdf-pages.json)
- [Browser audit](../../scratch/rm-report-finalization/browser-audit.json), [source/config audit](../../scratch/rm-report-finalization/source-diff.json), [final build log](../../scratch/rm-report-finalization/build.log)

Artifacts and temporary inspection helpers are under ignored `scratch/`; they are local QA evidence, not production data.

## Original finalization source files

1. `src/components/admin/rm-performance-workspace.tsx` — authorized preview and shared presentation/export scope.
2. `src/components/reports/client-snapshot-badge.tsx` — compact provenance, removed old banner.
3. `src/components/reports/rm-attendance-heatmap.module.css` — static calendar and future-demo marking.
4. `src/components/reports/rm-attendance-heatmap.tsx` — shared static/interactive calendar.
5. `src/components/reports/rm-attendance.tsx` — preview provenance in overview/detail.
6. `src/components/reports/rm-my-day-inputs.tsx` — section label/range text and shared field formatter.
7. `src/components/reports/rm-performance-pdf.tsx` — matching sections and measured complete export.
8. `src/components/reports/rm-performance-v4.css` — scoped preview, product accessibility and saved-entry print styles.
9. `src/components/reports/rm-performance-view.tsx` — requested heading/banner removal and section names.
10. `src/components/reports/rm-performance.css` — scoped PDF hover and pagination spacing.
11. `src/components/reports/rm-thrust-products.tsx` — source-preserving demo/blank rendering.
12. `shared/rm-attendance.d.mts` — optional preview metadata types.
13. `shared/rm-performance.d.mts` — optional preview metadata types.
14. `src/lib/rm-client-demo.d.mts` — preview adapter declaration (new).
15. `src/lib/rm-client-demo.mjs` — deterministic frontend-only fixture (new).
16. `scripts/fixtures/rm-report-finalization.mjs` — isolated QA report fixture (new).
17. `scripts/rm-report-ai-verification.test.mjs` — provider-context/cache/fallback verification (new).
18. `scripts/rm-report-finalization.test.mjs` — preview, browser, permission and PDF checks (new).
19. `docs/operations/rm-report-finalization.md` — this implementation/evidence report (new).


## 27 October 2026 local display changes

The FY 2026-27 Rais Khan chart fills missing monthly and four-week chart values with display-only sample values while preserving populated figures. The samples are not persisted as invoices and are not evidence for AI or business decisions. The heatmap no longer shows its **Future / unverified** legend key or the two demo explanatory lines; the grid and details remain. The Admin Field Activity page now has Visits and Follow-ups tabs only, and the Admin Team page hides its information strip and target PDF cutoff captions. See [the complete adjustment note](2026-10-27-ui-adjustments.md).
