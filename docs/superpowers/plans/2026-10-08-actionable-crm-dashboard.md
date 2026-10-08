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
