# Actionable CRM Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CRM from "showing numbers" into an actionable system that explicitly tells the manager who needs attention, highlights customer dependency risks, provides clear action summaries, and fully supports Call logging alongside Visit logging.

**Architecture:** We will enhance the existing Next.js frontend components in the `/admin` and `/sales` routes. Calculations for target achievement and dependency will be done client-side within the component data layers (reusing existing API responses which already include full actuals, targets, and visit logs). We will extend the existing `sales-workspace.tsx` form state to support a distinct "Call" action alongside "Visit".

**Tech Stack:** Next.js (App Router), React, Vanilla CSS.

**Spec:** Current conversation context outlining Palak's CRM requirements.

## Global Constraints

- **Styling:** Use Vanilla CSS in the existing stylesheets (`global.css` or module specific). Do not introduce Tailwind. Adhere to the existing premium, high-contrast aesthetic (e.g. `1.5px solid #cbd5e1`).
- **Dependencies:** Do not add new NPM packages. Use existing UI patterns (e.g. `<VoiceMicButton>`).

## Review Focus

- The new Admin RM table sorting doesn't handle RMs with 0 target correctly (div by zero). -> Test RM with missing target.
- The Call logging form fails to correctly attribute the GPS or voice note to the `follow_ups` or `visits` table schema. -> Test logging a call with text notes.
- Customer dependency math throws error if the RM has no invoices. -> Test RM with empty actual sales array.

---

### Task 1: Actionable Admin Team Dashboard (Traffic Lights & Sorting)

**Files:**
- Modify: `src/components/admin/admin-team.tsx`

**Interfaces:**
- Consumes: Existing `adminApi.team()` data (which provides `actual`, `target`, `visitsCompleted`, `followUpsOpen`, etc).

- [x] **Step 1: Calculate and append Target Achievement & Traffic Light status for each RM**
Within the component body, map over the incoming RM data to calculate `achievement = target > 0 ? (actual / target) * 100 : 0`. Assign a "status" string: `Needs Attention` (< 50%), `Average` (50%-80%), `Good` (> 80%). Add traffic light emojis (🔴, 🟡, 🟢) to match Palak's exact spec.

- [x] **Step 2: Force sort the RMs by achievement (Poor to Good) by default**
Ensure the default sorting state or initialization forces the lowest achievement percentage to the top of the table.

- [x] **Step 3: Update the Table UI (Stacked Flex & Traffic Light Pill Badge)**
Modify the row rendering in `admin-team.tsx` to display a clean, high-definition two-line stacked flex layout for the RM Name column: the RM name rendered in bold text on top, and a dedicated, rounded traffic-light-colored pill badge (`🔴 Needs Attention`, `🟡 Average`, `🟢 Good`) below, preventing awkward text wrapping and delivering an executive-grade UI/UX experience. Ensure the entire row remains clickable to `/admin/team/[id]`.

- [x] **Step 4: Verify UI changes**
Run the dev server, visit `/admin/team` and ensure the list is sorted lowest-to-highest with the correct traffic light pill badges.
- *UI Refinement:* Removed underline on RM name hover (`.rm-name-link:hover { text-decoration: none; }`) for cleaner executive presentation.
- *Integration & Field UX Polish:* Restored persistent visibility for Tally Connector Disconnect action button (`.admin-button`) and added distinct borders (`1px solid var(--line)`) with solid background to Unplanned Visit form dropdown fields (Customer, Purpose, Priority).

---

### Task 2: Customer Dependency & Health Analysis

**Files:**
- Modify: `src/components/admin/admin-rm-detail.tsx`

**Interfaces:**
- Consumes: The existing `/api/admin/team/[id]` data (`actualSales`, `customerVisits`, `tally_customers`).

- [x] **Step 1: Calculate "Top 5 Dealer Dependency" metric**
In `admin-rm-detail.tsx`, sort the `actualSales` by `salesValue` descending. Sum the top 5 values. Calculate the percentage this sum represents against the total `actualSales` sum. Also count the unique dealers in `actualSales`. 

- [x] **Step 2: Identify "New Customers" in last 6 months**
If the data provides an acquisition date or first invoice date, filter for customers added in the last 180 days. (If no strict creation date exists in Tally sync, mock or omit the explicit 6-month check and rely on "New" labels if present, or add a placeholder metric that counts recent additions).

- [x] **Step 3: Render the Customer Health Panel**
Inside the `Customer` or `Performance` tab (or create a new `Health` tab/section), render the Dependency Risk:
`"Dependency: 96% of sales come from top 5 dealers (out of 9 total dealers)."`. Add premium styling (e.g. a red/orange alert box if dependency > 80%). Add the "New Customers" metric.

- [x] **Step 4: Verify UI changes**
Visit `/admin/team/[some-id]` and check the new Dependency metric renders without crashing on empty data.

---

### Task 3: "What Should the Manager Do?" Summary Box

**Files:**
- Modify: `src/components/admin/admin-rm-detail.tsx`

**Interfaces:**
- Consumes: The metrics calculated in Task 2 + existing dormant dealers & achievement data.

- [x] **Step 1: Generate Actionable Summary Logic**
Create a function `generateManagerActionPlan(data, dependencyPct, achievementPct, dormantCount)`.
Returns a synthesized string or array of strings. Examples:
- "This RM is 81% behind target."
- "High dependency risk: ${dependencyPct}% of revenue comes from just 5 dealers. Action: Mandate prospecting for new accounts."
- "${dormantCount} dormant dealers need immediate follow-up."

- [x] **Step 2: Render Summary Box above the Tabs**
Insert a highly visible banner/box at the top of the detail page (below the header, above the tabs). Use a strong visual border (`1.5px solid #dc2626` or `#eab308` depending on severity).

- [x] **Step 3: Verify UI changes**
Visit `/admin/team/[some-id]` and ensure the summary explicitly tells the manager what to do, acting as an instant executive brief.

---

### Task 4: Explicit "Call" Logging with Voice-to-Text on Mobile

**Files:**
- Modify: `src/components/sales/sales-workspace.tsx`

**Interfaces:**
- Consumes: The `visit` logging form and `<VoiceMicButton>`.

- [x] **Step 1: Add "Log Activity Type" toggle**
In the "Log Visit" form section of the workspace, add a prominent segmented control or radio buttons to select `Activity Type: [🚗 Visit] [📞 Phone Call]`.

- [x] **Step 2: Adjust form requirements based on type**
When "Phone Call" is selected, disable the "GPS Check-in" requirement (since calls can be made from anywhere) but retain the Voice-to-Text notes (`<VoiceMicButton>`), Customer, Purpose, and Outcome fields.

- [x] **Step 3: Submit payload adjustment**
Update the form submission handler to pass `follow_up_type: 'call'` or `visit_type: 'call'` to the backend, depending on how the schema accepts non-physical interactions in the `visits` or `follow_ups` endpoints.

- [x] **Step 4: Verify UI and Submission**
Open the mobile view `/sales/my-day`. Select "Phone Call". Record a voice note, submit, and verify it appears in the activity feed correctly labelled as a call.

---

### Task 5: UI Refinements & Manager Action Plan Enhancements

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/admin/admin-rm-detail.tsx`

**Tasks Completed:**
- [x] **Ghost Button Visibility Fix:** Corrected a global CSS override in `globals.css` that forced white text on ghost buttons, rendering them invisible on white backgrounds. Excluded `.ghost` from the global hover fix.
- [x] **RM Action Plan - Visit Logs:** Embedded a "Recent Visits & Notes" list inside the Manager Action Plan banner in `admin-rm-detail.tsx`, ensuring Admins have immediate, zero-click access to all RM visit descriptions and outcomes.
- [x] **Compact Visit UI:** Streamlined the "Recent Visits & Notes" list by reducing paddings, merging lines, and making the layout much more space-efficient, adding a scrollable `maxHeight` so it scales nicely for highly active RMs.

---

### Task 6: Unplanned visits CRUD & Workspace UI changes

**Files:**
- Modify: `src/components/sales/sales-workspace.tsx`
- Modify: `server/app.mjs`
- Modify: `src/lib/api.ts`

**Tasks Completed:**
- [x] **Unplanned Visit Management**: Added `PATCH` and `DELETE` endpoints for `/api/visits/:id`. Implemented Edit and Delete controls inline within the Unplanned Visits list on the Field Sales `My Day` workspace.
- [x] **Date Visibility**: Displayed `scheduledAt` date strings natively inline with time values across Unplanned Visits and Follow-ups due dates. Added robust native `<input type="date">` editing within follow-ups inline note editing.
- [x] **Workspace Simplification**: Removed `Pipeline` and `Requests` tabs from `My Day` interface, locking the display strictly to immediate `Visits & Follow-ups` actions.

---

### Task 7: Additional Features (Supabase, Dormancy, Quarters)

**Tasks Completed:**
- [x] **Supabase Sync Automation**: Created `server/supabase-sync.mjs` with `ON CONFLICT DO UPDATE` upsert logic to ensure zero-overlap syncing. Directly integrated background spawning inside `server/connector-api.mjs`.
- [x] **Quarter-wise Trend Dashboard**: Designed and added Q1-Q4 visual progress bars tracking aggregate invoice data in `admin-overview.tsx`.
- [x] **Dormant Dealer Alerts**: Built >90-day purchase disengagement checks in `rm-routes.mjs` and added an RM justification feedback form directly in `rm-customers.tsx`.
- [x] **RM Report Gap Analysis**: Generated comprehensive markdown artifact comparing the client's `demoRMreport.txt` spec against the current dynamic implementation in `print-report/page.tsx`, identifying critical missing tracking metrics (Weekly breakdown, YoY YoY, Territory Expansion compliance).

---

### Task 8: Executive RM Report Card Enhancements & Strategic Thrust Products Tracking

**Files:**
- Modify: `server/db.mjs`
- Modify: `server/admin.mjs`
- Modify: `server/rm-directory.mjs`
- Modify: `src/types/admin.ts`
- Modify: `src/components/admin/admin-rm-detail.tsx`
- Modify: `src/components/admin/admin-team.tsx`

**Tasks Completed:**
- [x] **Strategic Thrust Products Schema & Seeding**: Added `thrust_products` table and migration in `server/db.mjs` seeded with 9 annual strategic lines (*Zpn Blue 15, Zpn 200, Zpn Black, Shimaclad Peony, Clearclad Lcbh, Enilex Chrome Catalyst, POP, Uviclad 612, Patinas*).
- [x] **Admin Thrust Leaderboard & Metrics**: Extended `GET /api/admin/team` to compute cross-team thrust performance, ranking RMs by revenue, units sold, and active products. Added `🎯 Thrust Sales` column and Leaderboard card to `admin-team.tsx`.
- [x] **Target vs Achievement Monthly Visual Graph**: Built `TargetVsActualMonthlyChart` in `admin-rm-detail.tsx` displaying 12-month dual-bar graph with percentage achievement pills and diff indicators.
- [x] **Dedicated Manager Action Plan Tab**: Extracted manager guidance from AI insight into its own standalone 8th tab (`📋 Manager Action Plan`), preserving top directives, territory gap assessments, concentration risk, and scrollable visit logs.
- [x] **RM Code & Operating Cities Badges**: Dynamically formatted RM code identifier and operating city tags in the header.
- [x] **Special Achievements Showcase**: Displayed key achievement milestones (Target Crusher, Consistent Biller, High Volume, Customer Retention) in a high-contrast metric card grid.
- [x] **Field Salesperson Normalization**: Refined `isSamePerson` in `rm-directory.mjs` to strip `(Field)` suffix for reliable invoice and visit attribution.

---

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

