# Actionable CRM Dashboard Plan — continued

Continuation of [the dashboard plan](./2026-10-08-actionable-crm-dashboard.md).

### Task 9: RM Dashboard Enhancement, Clock-in Fix & Unplanned Visit Smooth Transitions

**Tasks Completed:**
- [x] **RM Dashboard Visual Elevation & De-cluttering**: Enhanced visual design with high-contrast executive tokens, removed redundant "Region: North Region" pill from navigation for a clean layout.
- [x] **Interactive Clock-in / Clock-out Button Fix**: Restored real-time persistence and UI state toggle on the RM dashboard header, reflecting accurate attendance status immediately without page reloads.
- [x] **Add Unplanned Visit Fix**: Resolved silent 403 access control failures by dynamically binding options to verified customers from `data.referenceData.customers` instead of dummy IDs.
- [x] **Modal Form State Reset**: Ensured fresh state initialization on open and edit to avoid stale input values.

---

### Task 10: Data Loading Acceleration & Resilient SWR Caching

**Tasks Completed:**
- [x] **Composite Database Indexing**: Added `idx_tally_customers_rm_name`, `idx_tally_invoices_session_date`, `idx_tally_invoice_lines_inv_prod`, and `idx_tally_rm_product_sales_rm` to optimize joins over 53,000+ invoice and line item records.
- [x] **Single-Pass Thrust Batch Aggregation**: Built `calculateAllThrustProductsBatch()` in `server/admin.mjs` to aggregate annual thrust chemical product lines in a single memory pass, eliminating 330+ repetitive SQL queries and reducing `/api/admin/team` response time from 3,630ms to ~450ms.
- [x] **Stale-While-Revalidate (SWR) In-Memory Cache**: Upgraded `useAdminData` with in-memory caching for instantaneous tab transitions while updating data smoothly in the background.
- [x] **Composite Cache Key Isolation**: Namespaced cache keys with function source strings (`${loaderSource}::${JSON.stringify(deps)}`) to ensure clean isolation between different API endpoints.
- [x] **Defensive Null-Safe Property Accessors**: Added safe optional chaining and fallback defaults in `AdminOverview` (`summaryLine`) to prevent `TypeError` during state transitions.

---

### Task 11: RM Self-Managed Visit Planning & Comprehensive Admin Panel Reflection

**Tasks Completed:**
- [x] **Multi-Tier Customer Authorization (`canAccessCustomer`)**: Updated `server/sales-routes.mjs` to synchronize customer access with directory and territory assignments (`c.rm_name IN (...)`, direct ownership, manager accounts, and subordinate accounts). RMs and field sales representatives can schedule unplanned visits for any customer in their zone without 403 access rejections.
- [x] **Multi-Account Scoping on Admin Panel (`/admin/team/:id`)**: Updated `visitsKpi`, `customerVisits`, `pipeline`, `followUps`, and `todayActivity` queries in `server/admin.mjs` to aggregate activity across all linked accounts (`sp-101`, `rm-anil-jena`, and managed team reps).
- [x] **Live Reflection Across Portals**: Any visit created by the RM or field sales representative instantly populates the Sales Workspace (`/sales/my-day`) and the Admin Panel (`/admin/team/[id]` under *Customer Visits* and performance counters).

---

### Task 12: Unified Follow-Up Button & Resilient Sales Check-In

**Tasks Completed:**
- [x] **Single Consolidated Follow-up Button**: Removed duplicate `+ New` buttons from both Action List and Scheduled card headers in Sales Workspace (`sales-workspace.tsx`), replaced with a single prominent full-width `+ Schedule New Follow-up` button at the bottom of the Upcoming Follow-ups card.
- [x] **Resilient Check-In with Geolocation Fallback**: Added graceful timeout and error fallback to `handleCheckIn()`. Users on desktop PCs or devices without active GPS can check in seamlessly without being blocked by location permission errors.
- [x] **Follow-up Modal Error Handling & Saving State**: Added inline error alert and `savingFollowUp` loading state inside the Schedule Follow-up modal for immediate feedback.
- [x] **Background Ping Silence**: Suppressed intrusive error banners on failed background location pings during active tracking.

---

### Task 13: Report Card Simplification & High-Performance Ask AI Upgrade

**Tasks Completed:**
- [x] **Key Insights & Next Actions Removal**: Removed the AI insights card from both the Admin RM Detail view (`/admin/team/[id]`) and the RM Report Card (`/rm/report-card`) as requested.
- [x] **Special Achievements & Milestones Blank State**: Retained the executive `🌟 Special Achievements & Milestones` container while clearing out hardcoded milestone badges to keep the field blank.
- [x] **Ask AI Engine Upgrade**: Upgraded `server/ai-context.mjs` from deprecated Gemini models to active `gemini-3.8-flash` (primary) and `gemini-3.6-flash` (fallback).
- [x] **Sub-4-Second Response Optimization**: Added `thinkingBudget: 0` to Gemini generation config, reducing query turnaround time to ~3 seconds with robust thought-token stripping.

---

### Task 14: Sales Workspace Monthly Performance Card Realignment

**Tasks Completed:**
- [x] **Active Ledger Period Badge**: Linked `data.performance.periodLabel` to the header of the Monthly Performance card in `/sales/my-day`, displaying `📅 This Month (2026-09 active ledger)` for unambiguous temporal context.
- [x] **Dynamic Surplus vs Gap Indicator**: Replaced flat `Gap: ₹0` with dynamic calculation. When actual exceeds target, displays positive green `Surplus (+35%)` with value `+₹16.22 L`.
- [x] **Target Achieved Milestone Status & Green Progress Bar**: Added green `✓ Target Achieved` pill when achievement >= 100% and dynamic green gradient progress bar fill.

---

### Task 15: RM Detail Visit Date Filtering & Executive Report Card PDF Download View

**Tasks Completed:**
- [x] **Temporal Visit Query Filtering**: Updated `server/rm-routes.mjs` so `GET /api/admin/team/:id` strictly applies start and end date filters (`startDate`, `endDate`) to customer visits queries, ensuring temporal consistency when switching between *Today*, *This Week*, *This Month*, and *FYTD*.
- [x] **Header "Download Report" Action Button**: Added green `⬇ Download Report` button (`.rm-download-report-btn`) next to period pills in `src/components/admin/admin-rm-detail.tsx` with dedicated hover and focus styling in `src/app/admin.css`. Opens the report in a new tab.
- [x] **Dedicated Print Page Route (`/admin/team/[id]/print`)**: Created `src/app/admin/team/[id]/print/page.tsx` and `print-report.css` featuring:
  - Fixed top action controls bar with "Download PDF" (`window.print()`) and "Close" controls (hidden during printing).
  - Branded header banner with PSSPL logo, RM code, operating city, and performance achievement %.
  - 8 executive KPI cards (Target, Actual, Remaining/Surplus, Active Customers, Visits, Follow-ups, Products, Achievement %).
  - Visual Target vs Actual progress bar with exact financial values and gap indicator.
  - Side-by-side Top Customers and Top Products tables.
  - Recent Visits and Open Follow-ups logs.
  - Timestamped verification footer and print-optimized `@media print` CSS rules.

---

### Task 16: In-Page Report Preview Modal & Strict 2-Page Executive PDF Engine

**Tasks Completed:**
- [x] **In-Page Report Preview Modal (`RmReportPreviewModal`)**: Replaced external page/tab navigation with an interactive in-page modal dialog. Clicking `Download Report` opens the preview on the same screen (`/admin/team/[id]`) with a dark backdrop, top action toolbar (`⬇ Download PDF`, `✕ Close`), and document viewer.
- [x] **AI Insight & Manager Action Plan Integration**: Integrated **AI Executive Diagnostic & Field Intelligence** and **Manager Action Plan Directives** into Page 2 of the downloaded report card PDF, while keeping the web dashboard tabs clean and unmixed.
- [x] **Strict 2-Page Document Layout (`RmReportDocument`)**:
  - **Page 1**: Executive cover card with achievement badge (`135%`, `On Track ✅`), 8 KPI metrics cards, Target vs Actual achievement bar, Top 7 Customers table, Top 7 Products table, and Page 1 Footer.
  - **Page 2**: Section 2 header banner, AI Sales Insight Diagnostic narrative, Manager Action Plan directives with urgency tags and direct supervisory action items, Recent Field Visits, Open Follow-ups, and Page 2 Footer.
- [x] **Blank Pages Bug Resolution (`downloadRmReportDirect`)**: Replaced `html2pdf.js` tall container slicing (which created 2 empty overflow pages in the middle) with direct page-by-page rendering using `html2canvas` and `jsPDF`. Page 1 (`#rm-report-page-1`) and Page 2 (`#rm-report-page-2`) are captured to dedicated retina canvases and placed onto exact A4 pages (`210mm × 297mm`), guaranteeing strictly 2 pages with 0 blank pages.

---

### Task 17: High-Impact 12-Month Target vs Actual Sales Visual Graph in Report Card Download

**Tasks Completed:**
- [x] **High-Impact Vector SVG Graph**: Embedded a native SVG dual-bar chart on Page 1 of `RmReportDocument` in [src/components/admin/rm-report-pdf.tsx](file:///c:/Users/deepa/psspl/src/components/admin/rm-report-pdf.tsx) visualizing the full 12-month Financial Year trajectory (`monthlyTargetVsActual`).
- [x] **Performance Badges & Color Coding**: Each month displays target bars (neutral slate `#cbd5e1`) and actual billing bars (emerald `#16a34a` for ≥100% achieved, vibrant blue `#0284c7` for <100%), with bold percentage labels above active months.
- [x] **Zero-Latency & Crisp Capture**: 100% pure inline SVG with zero external charting library bloat, ensuring 0ms rendering and crystal-clear retina capture during PDF generation and in-page preview.
- [x] **Page 1 Layout Budget**: Neatly calibrated height and spacing ensuring all 8 KPI cards, the dual-bar chart, and top customers/products tables fit within the 1122px A4 height budget without triggering any page overflow.

---

### Task 18: Ask AI UI Overhaul, Full Mobile Responsiveness & Production Cloud Deployment

**Tasks Completed:**
- [x] **Ask AI Command Center Redesign (`HeaderAiAsk`)**: Transformed header search input into a sleek command palette trigger with keyboard shortcut listener (`Ctrl K` on desktop, auto-hidden on mobile).
- [x] **Instant Date Presets & Clear Search**: Integrated quick range buttons (`FY 2026-27`, `Last 30 Days`, `All Data`) and an instant clear button (`✕`) with automatic refocus inside the Ask AI modal.
- [x] **Categorized Query Chips**: Replaced plain text prompts with visual emoji badges across 7 core business intelligence areas (underperforming products, regional demand, RM leaderboards, collections/dues, customer retention, field ops, and dormant accounts).
- [x] **Off-Canvas Mobile Navigation**: Converted fixed desktop sidebar into a mobile drawer (`< 1000px`) with animated vector hamburger toggler and touch backdrop dismiss (`.admin-sidebar-backdrop`).
- [x] **Fluid Grids & Viewport Safety**: Converted fixed CSS grids into responsive classes (`.rm-kpi-grid` 6-to-3-to-2 cols, `.rm-3col-grid` to 1 col, `.rm-thrust-grid` auto-fit, `.overview-quarterly-grid` auto-fit), enforced `min-width: 0` on grid items, and applied global `overflow-x: hidden; max-width: 100vw` with scoped horizontal table scrolling.
- [x] **Production Cloud Deployment**: Deployed production frontend to Vercel (`https://psspl-crm.vercel.app`) with static optimization across 27 routes, configured Render backend (`https://psspl-crm-backend.onrender.com`), and synchronized all code to GitHub (`https://github.com/DeepakSingh-gh/psspl`).

---

### Task 19: Laptop Viewport Side-Scroll Elimination & CSS Clipping Architecture

**Tasks Completed:**
- [x] **Root Viewport Clipping**: Upgraded `html`, `body`, and `.crm-shell` / `.admin-shell` from `max-width: 100vw; overflow-x: hidden;` to `width: 100%; max-width: 100%; overflow-x: clip;`, eliminating horizontal panning caused by vertical scrollbars on Windows/Blink laptops.
- [x] **Fixed Desktop Sidebar Geometry**: Pinned `.admin-sidebar` to `width: 264px; min-width: 264px; max-width: 264px; flex-shrink: 0; left: 0;`, preventing navigation shrinkage or off-screen horizontal drift.
- [x] **Responsive Grid Track Collapse**: Expanded the collapse threshold for `.command-story` and `.command-money-field` from `1100px` to `1280px` (`@media (max-width: 1280px)`), replacing unbounded pixel tracks with `minmax(0, 1fr)`.
- [x] **SVG Chart Overflow Protection**: Constrained `.command-chart` and `.command-chart svg` with `overflow: hidden;` preventing chart blowout on narrow desktop screens.

---

### Task 20: Webpack Dev Server Chunk Cache Resiliency

**Tasks Completed:**
- [x] **Root Cause Investigation**: Identified that running `npm run build` while `npm run dev` was active replaced development chunks in `.next` with production hashes, causing `Cannot find module './308.js'`.
- [x] **Cache Clean & Process Recovery**: Terminated stale dev runner processes, purged the `.next` directory, and cleanly restarted the development server.
- [x] **Route Verification**: Confirmed `/admin` compiles cleanly in 1245ms and returns HTTP 200 OK without errors.

## Latest local follow-up ? 16 October 2026

The published Manager Action Plan / AI Insights ordering remains in commit `87eae1e`. New local changes add a fixed manual Refresh Data control on data pages, with explicit login/root exclusions and print hiding.

Admin Overview, Team, RM detail, Field Activity and Alerts now opt into shared attendance-revision polling every two seconds while visible. Only changed revisions invalidate caches; loaders refresh without resetting tab/filter state. Hidden-tab skipping, timeout/cleanup and temporary-error recovery are covered by focused tests.

Report availability is separate from attendance freshness: the local ledger has 78 September invoices, latest dated `2026-09-08`, and none for the selected 1?16 October range. The report date logic was not changed.

All pending code/documentation work remains local, awaiting a later user-authorized combined release.

Release context: [source synchronization and deployment status](../reports/2026-10-16-production-source-sync.md).

> Current project status (19 October 2026): See the [production readiness report](../../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
