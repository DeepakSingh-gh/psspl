# SDD ledger — plan: docs/superpowers/plans/2026-10-08-actionable-crm-dashboard.md

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../../docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../../docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->


## Follow-up ledger ? 16 October 2026

- [x] Manager Action Plan moved to the first/default admin RM report tab; AI Insights moved to second. Remaining tab order preserved.
- [x] RM sign-in and legacy /rm redirect use the shared My Day / Customer DB workspace.
- [x] Frontend releases verified READY on Vercel through commit 87eae1e; public report route and deployed tab labels/order verified.
- [x] TypeScript, whitespace, provider checks and local My Day regression checks passed in the relevant code tasks.
- [x] Local main tracks user-owned DeepakSingh-gh/psspl/main.
- [ ] Backend provider/query/compression rollout awaits live SQLite preservation.
- [ ] Persistent Vercel Git connection remains permission-blocked; frontend deployments were explicit API releases.

The older completion entries remain historical evidence. This Markdown refresh is local only and does not commit, push, deploy or migrate data. See the [source-sync report](../../../docs/superpowers/reports/2026-10-16-production-source-sync.md).

Task 1: complete (commits manually applied inline, tests: manual visual verification -> pass)
Task 2: complete (commits manually applied inline, tests: manual visual verification -> pass)
Task 3: complete (commits manually applied inline, tests: manual visual verification -> pass)
Task 4: complete (commits manually applied inline, tests: manual visual verification -> pass)
UI Polish: complete (Tally disconnect visibility, Unplanned visit field borders, RM name hover underline removal -> pass)
Task 6: complete (commits manually applied inline, tests: manual visual verification -> pass)
Task 7: complete (Supabase sync, quarter trend analysis, dormant dealer alerts -> pass)
Task 8: complete (Thrust products schema & admin leaderboard, monthly target vs actual graph, 8-tab RM report card with dedicated Manager Action Plan, RM code, operating cities, special achievements -> pass)
Task 9: complete (Fixed RM target inflation from CRORE to LAKH, synchronized tally_rm_targets across all RMs, Anil Jena showing accurate 280% on ₹14.02 Cr sales vs ₹5.01 Cr target -> pass)
Task 10: complete (Removed RM report card button & navigation links from RM dashboard and sales workspace -> pass)
Task 11: complete (Harmonized monthly target card in /sales/my-day with formatRupees live Lakhs/Rupees formatting -> pass)
Task 12: complete (Sticky RM table column headings on scroll in /admin/team via admin-table-wrap scroll container -> pass)
Task 13: complete (Redesigned Anil Jena & RM detail view into a clean, friendly, executive layout with streamlined profile hero, compact coverage cities bar, and compact milestone highlights strip replacing large vacant box architecture -> pass)
Task 14: complete (RM dashboard visual enhancement, removed duplicate region pill, fixed live Clock-in button state, fixed Unplanned Visit creation by linking to active reference customers, added animated custom select dropdown with cubic-bezier transitions -> pass)
Task 15: complete (Performance optimization: SQLite composite indexes on invoices/customers/lines, single-pass in-memory thrust batch aggregation reducing API latency from 3.6s to 450ms, SWR client caching with namespaced keys, defensive overview null checks -> pass)
Task 16: complete (RM unplanned visit planning fix: multi-tier access control in canAccessCustomer matching RM territory and team accounts, full visit and pipeline reflection across all linked RM accounts in Admin panel /admin/team/:id -> pass)
Task 17: complete (Unified follow-up creation button in Sales Workspace /sales/my-day, resilient check-in with geolocation graceful fallback for desktop/non-GPS devices, inline follow-up modal error handling and saving states -> pass)
Task 18: complete (Cleared hardcoded milestone data in Special Achievements & Milestones keeping field blank, removed Key Insights & Next Actions from report cards, upgraded Ask AI to gemini-3.8-flash and gemini-3.6-flash with thinkingBudget 0 for 3s response time -> pass)
Task 19: complete (Sales Workspace monthly performance card realignment: added active ledger period badge, dynamic surplus (+35%) vs gap calculation, and Target Achieved badge -> pass)
Task 21: complete (Direct in-page report preview modal replacing new tab opening: clicking "Download Report" opens RmReportPreviewModal on same page without navigation or popups -> pass)
Task 22: complete (Integrated AI Executive Diagnostic & Field Intelligence and Manager Action Plan Directives into Page 2 of the downloaded report card PDF, keeping dashboard tabs clean and unmixed -> pass)
Task 23: complete (Fixed multi-page blank page bug: replaced html2pdf.js continuous container auto-slicer with direct page-by-page jsPDF + html2canvas engine rendering Page 1 and Page 2 to dedicated canvases, guaranteeing strictly 2 pages with 0 blank pages -> pass)
Task 24: complete (Embedded high-impact 12-month Target vs Actual Sales vector SVG dual-bar graph on Page 1 of the executive report PDF and in-page preview modal with 0ms rendering overhead, crisp gridlines, quota bars, and percentage badges -> pass)
Task 25: complete (Ask AI UI redesign with date range presets, quick clear button, emoji chips; mobile-first responsiveness down to 360px with off-canvas drawer navigation, responsive grids, overflow protection; and production cloud deployment on Vercel + Render -> pass)
Task 26: complete (Laptop/desktop horizontal side-scroll elimination: replaced 100vw/overflow-x: hidden with width: 100%; max-width: 100%; overflow-x: clip; pinned 264px sidebar geometry, responsive minmax(0, 1fr) tracks at <= 1280px, SVG chart overflow clipping -> pass)
Task 27: complete (Webpack runtime dev chunk cache recovery for ./308.js missing chunk error, clean cache purge, live Tally tables tally_payments_live, tally_purchases, tally_purchase_lines, and composite indexes documented across all md files -> pass)
Final review: complete

## Latest local follow-up ? 16 October 2026

- [x] Local manual refresh button added; removed from login/root pages and hidden in print.

- [x] Overview/Team/RM detail/Field Activity/Alerts connected to shared attendance change checks; unchanged revisions avoid full dashboard refetches.

- [x] Monitor lifecycle/error checks and isolated-snapshot real clock-in/out verification passed; no actual attendance records changed.

- [x] October report empty state explained by ledger coverage ending `2026-09-08`; September has 78 invoices and the selected October range has none.

- [ ] Combined rollout of pending local code and Markdown changes, on a later explicit user instruction. Last verified live frontend remains `87eae1e`.

Release context: [source synchronization and deployment status](../../../docs/superpowers/reports/2026-10-16-production-source-sync.md).
