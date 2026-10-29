# Supplied RM feedback snapshots

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

The 12 supplied one-page sales feedback PDFs are compiled into `server/data/rm-feedback-snapshots.json`. They are dated **30 September 2026**, financial year **2026-27**, with monetary values in **INR lakh**. They are historical supplied reports, separate from live Tally/CRM performance. This change does not create employee accounts, invoices, customer assignments or sales transactions.

## Access and retrieval

- Admin: **Team performance > an RM** opens the [V4 workspace](rm-performance-v4.md) with FY/month/four-week drill-down, scoped attendance, YTD product contribution and PDF export. Supplied aggregates remain a financial source when live FY evidence is absent. The original eight-tab V1 descriptions below are historical. The standalone `/admin/rm-feedback` source viewer remains reachable directly for source inspection.
- RM: **Report Card**, at `/rm/report-card`, uses the shared V4 workspace restricted to the signed-in RM and verified subordinate selection. `/rm/print-report` retains the separate source print template, populated with that RM's own snapshot. An unknown or conflicting identity never falls back to another RM.
- API: admin-only `GET /api/admin/rm-feedback` and `GET /api/admin/rm-feedback/:id`; authenticated RM-only `GET /api/rm/print-report`.
- `server/rm-feedback.mjs` reads the compiled JSON once when the process starts, freezes it and indexes it by ID, code and normalized exact name. Requests do not parse PDFs, call AI or query sales aggregates. Restart the API after replacing compiled data outside development watch mode.
- The old print path contained Anil Jena's sample figures for every RM. Its original template now binds the selected RM's own financial tables, team/cities, territory expansion, registration, technical service and thrust products.

`src/lib/rm-feedback-data.ts` maps snapshots into the existing report contracts. Month displays the latest complete reported month at or before the requested cutoff, capped at the snapshot date. FYTD retains the printed YTD target and percentage at the snapshot date; earlier cutoffs use complete reported months only. Daily/weekly figures and other financial years are not synthesized from these monthly aggregates. The source date appears in the existing descriptions and download report cycle. Amounts are converted from INR lakh to rupees exactly once.

Operational CRM records and ownership status stay intact. Snapshot aggregates do not supply invoice counts, dealer attribution or per-product sales. Thrust totals and source product names populate the existing product card; missing individual sales appear as unavailable. A printed blank monthly actual stays unavailable and does not cause a different month's actual to be substituted.

As of 22 October, the admin Report Card fills empty pipeline, dealer and product tables with separate **Demo** presentation rows; matching customer/product tables in the two-page PDF preview carry the same label. This does not alter snapshot aggregates, live CRM records, actual KPIs or the RM-facing print template. Real rows replace presentation rows whenever available.

For Rais Khan only, an empty Today/This Week period can show a separate **Demo preview** of sales, target pace and activity. Its chart follows the selected period: Today is a daily total; This Week is day-wise Monday through Saturday. Saturday is included in the weekly target and has no actual bar until sales are recorded. Bar details appear beside the chart only while a bar is hovered or focused. These preview values are display-only and do not change the supplied snapshot, CRM records or AI analysis. The two-page admin PDF uses the selected period's chart too. See the [current implementation notes](2026-10-21-current-state.md#rm-report-card-update--23-october-2026).

## Source manifest

| RM | Source RM code | Operating city |
| --- | --- | --- |
| Ketan Bhatt | 271704 | Mumbai |
| Anil Jena | 075709 | Gurugram |
| Gowri Shankar | 333716 | Chidambaram |
| Harsh Shah | 271702 | Mumbai |
| Jithin Thomas | 322631 | Kerala |
| Nazmul Islam | 000739 | Bangladesh |
| Pradeep Mulik | 273707 | Pune |
| Rais Khan | 033705 | Ludhiana |
| Sourav Ranjit | 191732 | Kolkata |
| V Ramesh Kumar | 337713 | Coimbatore |
| Vilas Kharabe | 243712 | Rajkot |
| YP Sharma | 092703 | Aligarh |

Each record retains the original filename, SHA-256, page number and extracted source text. Leading-zero codes remain strings. Source spelling is retained in source fields. Only explicit known name aliases are accepted; there is no fuzzy identity matching.

Blank/dash financial cells remain `null`, distinct from printed zero. Future months are not populated with invented actuals. Annual/YTD and full-year monthly totals and percentages retain their printed denominators rather than being silently reconciled. Product sales cells retain source text where a numeric-to-product association is ambiguous. The UI exposes source text for review.

## Updating the supplied data

Keep the original PDFs intact. To compile a replacement set with the same report layouts:

```powershell
python -m pip install pypdf pymupdf==1.26.7
python scripts/import-rm-feedback.py 'C:/path/to/supplied-pdfs'
npm run test:rm-feedback
```

Python packages and the original PDFs are needed only during this deliberate import. They are not runtime dependencies. Review generated values, names, team/territory columns and source warnings against all source pages before accepting a new layout or reporting date. The importer currently expects 30 September 2026 and the supplied twelve names; a new reporting period requires an explicit importer update. Rotated source labels can produce pypdf warnings; metadata uses PyMuPDF table geometry and the numeric matrices use aligned text.

## Local verification

`scripts/rm-feedback.test.mjs` covers all twelve snapshots, source-specific figures and nulls, immutable indexed lookup, exact identity matching and authenticated admin/RM access with a disposable database. Related security, RM report and management regression suites must also pass. Browser checks use mocked API data to verify selection, own-RM rendering and mobile width without changing live records. Build/type checks validate the shared UI.

This is a local source change. No deployment, external email, source-PDF modification or production-data migration is performed.

Verified locally on 21 October 2026: 30 tests passed across RM feedback, phase 3 RM reports, phase 4 management and phase 1 security. The five snapshot tests were rerun after the final team/city extraction correction and passed. `npm run build`, `npx tsc --noEmit` and `git diff --check` passed. Mocked browser checks passed for all twelve selectors, switching between reports, team fields, 390px mobile width, print controls and the signed-in RM view, with no browser errors.

The current UI regression is covered by `node --test scripts/rm-feedback-browser.test.mjs` with a local Next dev server running (default `http://localhost:3000`, override with `CRM_BROWSER_TEST_URL`). All API requests are mocked. It opens the reported admin URL, verifies the original eight tabs and Action Plan, checks populated monthly cards/chart/thrust totals, switches FYTD, opens the existing download preview, and checks the original RM Report Card and original print template using Ketan's own figures. `scripts/rm-feedback-data.test.mjs` covers all twelve conversions, printed FYTD percentages, nulls, period boundaries and preservation of operational records. The current adapter/API/security regression run passes 34 tests; the browser flow passes separately.

## Team list and duplicate-account correction

The Team performance API now also maps every supplied RM's FYTD actual, printed target-to-month, percentage, prior-year actual and thrust total into its existing table fields for FY 2026-27. Other years continue using their own live records. The RM directory includes supplied report names, so Jithin Thomas appears even without a CRM login. This does not create an account. Individual product counts and leading products remain unavailable when the PDF only supplies a total. Table descriptions identify the PDF date; customer ownership, outstanding and field activity remain CRM values.

On 21 October 2026, the explicitly requested local duplicate cleanup retained `rm-anil-jena` (`anil.jena@psspl.com`, employee code `075709`) and archived `rm-anil-alias` (previous email `anil@psspl.com`, code `075709-ALIAS`). The alias had no reporting employees or customers. A consistent SQLite backup was taken first under ignored `scratch/rm-feedback/`; the cleanup result is recorded there in `duplicate-cleanup-result.json`. The primary RM's 10 reporting profiles and 62 customers were unchanged. Alias sessions/tokens were revoked and unsent emails canceled; historical identity remains restorable through the archive. Both legacy import/seed scripts were corrected to stop creating another alias account; they were not run against local data.

Verification after correction: 39 API/data/security/deletion tests passed, TypeScript and production build passed. A read-only backup of the current database was copied into an isolated test database; its admin API and a browser verified all 12 actual directory entries, their own list totals, existing FYTD Report Card rendering and only one active Anil Jena RM. No live emails or deployment occurred. Vijay Nair has no supplied PDF in this set, so no PDF figures are fabricated for that account.

## Ranking and historical sales availability

**Poor to good** sorts ascending by known target achievement percentage; **Good to poor** reverses that order. Members with missing/nonfinite achievement remain last in both directions. If no member has achievement data, recorded sales value is used instead. A missing target on one account no longer switches the whole table to revenue-volume ranking. Zero achievement is valid and stays in the ranked group.

Vijay Nair's imported workbook product aggregates contain INR 6,791,033.39 for FY 2024-25 and INR 7,880,696.03 for FY 2025-26. The local database had no mapped current-FY invoices, customer assignments or supplied 2026-27 PDF for him when checked. Before the later requested archive described below, the table displayed **Selected FY data unavailable**, with the separately labeled workbook history, rather than interpreting a missing current data source as proof of zero sales. No historical amount is copied into the current FY.

This correction passed 37 API/data/security regressions, the dedicated `scripts/admin-team-sorting-browser.test.mjs` flow (both sort directions and historical labels), and the production build. The database inspection was read-only.

## Requested Vijay Nair removal

Later on 21 October 2026, the user explicitly requested deleting Vijay Nair because no PDF was supplied. His local `rm-vijay-nair` account was archived after a consistent SQLite backup, with sign-in sessions/tokens revoked, unsent email canceled and credentials removed. He had no reporting employees or customer ownership requiring reassignment. The result is recorded in ignored `scratch/rm-feedback/vijay-archive-result.json`; his FY 2024-25 and FY 2025-26 workbook aggregates were verified unchanged.

Active Team performance lists and detail routes exclude archived RM identities even when workbook/master rows remain. A surviving active account with the same canonical name remains visible, so the archived Anil alias does not hide the retained Anil account. Historical directory lookup remains available to historical workflows, and Archive restoration remains supported. The twelve supplied PDF RMs remain in the active reporting directory. No UI layout change was made.

## Percentage review

Achievement is `actual / positive target * 100`, rounded to a whole percentage for display. It is not capped at 100%; only the width of progress bars is capped. A missing actual or missing/nonpositive target yields unavailable, while an explicitly reported zero actual against a positive target yields 0%. `shared/achievement.mjs` supplies this calculation to report adapters, the team table, RM card, print percentages and Claude evidence.

Pradeep Mulik's supplied PDF was independently rechecked. Amounts below are INR lakh:

| Comparison | Actual | Denominator | Achievement |
| --- | ---: | ---: | ---: |
| August | 160.72 | August target 11.00 | 1461% |
| September | 124.58 | September target 12.10 | 1030% |
| FYTD | 397.92 | Printed target-to-month 67.10 | 593% |
| Annual target | 397.92 | Full-year target 132.00 | 301% |

The large percentages match the source figures; a monthly target and full-year target are different denominators. The chart summary now explicitly says **Annual Target Achievement**, with **Sales Reported to Date**, instead of the ambiguous overall/12-month labels. Missing-month tooltips show unavailable and no actual bar rather than implying 0%. The RM-side card no longer clips displayed achievement to 100%. The underlying supplied PDF/source JSON remains unchanged.

The latest percentage review passed 41 adapter/API/management/security tests, the dedicated admin/RM percentage browser flow, TypeScript and production build. These are scoped local results, not a new production sign-off.

`scripts/rm-feedback-data.test.mjs` checks all supplied observed monthly percentages and both annual-summary YTD percentages against the formula, plus the distinct Pradeep ratios and missing/zero cases. `scripts/rm-percentage-browser.test.mjs` verifies the original admin/RM UI, annual 301%, FYTD 593%, monthly 1461%/1030%, absence of missing-month actual bars and unavailable tooltips.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.

<!-- rm-report-current:start -->
## Historical RM report card - 22-10-2026

- Select an RM (Admin only), Weekly / Monthly / Yearly, financial year, month and week as applicable. Press **View Report** to apply and open the Report Card tab. RM accounts remain restricted to their authorized data.
- Desktop filters are compact; KPIs and chart come first, with insights/actions side by side and stacked mobile sections. PDF retains two A4 pages.
- **Download PDF** also applies pending filters, opens the matching preview and saves from its download button. Export errors provide a retry message; filenames use selected-period dates.
- Executive Territory Coverage groups each executive with their cities beneath the profile and on PDF page 2. The supplied-report date is visible; dealer locations are not substituted as executive assignments.
- Rais Khan reuses existing supplied monthly/weekly/yearly financial data when live invoices are absent; separately labeled sample details remain a documented presentation exception. Missing source achievements stay unavailable. Other RMs receive no sample fallback.
- Latest local checks: all 5 dynamic-period tests, TypeScript and changed-file whitespace checks passed, including dashboard/PDF mapping parity and PDF footer fit.

See [period rules, source limitations and verification](rm-period-reports.md) and [other UI/loading changes](2026-10-22-ui-and-performance.md). The proposed Claude Call Sheet image is a preview, not an implemented feature set. No production deployment or production-data modification was performed for these updates.
<!-- rm-report-current:end -->
