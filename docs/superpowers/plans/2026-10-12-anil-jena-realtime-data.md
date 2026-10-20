# Anil Jena Real-Time Data Integration Implementation Plan

## Follow-up status ? 16 October 2026

The seed/import steps below describe historical data integration and were not rerun during the current update. Local and Render databases remain separate; Anil Jena RM, alias and field accounts have not been merged. Copying source files or publishing Vercel does not synchronize their account records, attendance or sales data.

RM entry now opens /sales/my-day with My Day and Customer DB navigation. Specialized feedback/report routes remain implemented. Admin report tabs start with Manager Action Plan (default) and AI Insights; the latest verified frontend commit is 87eae1e. Preserve live SQLite data before the still-pending backend rollout. See the [source-sync report](../reports/2026-10-16-production-source-sync.md). This documentation update is local only and changes no seed data or database schema.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest and synchronize the complete real-time PDF data for Regional Manager Anil Jena (RM Code: `075709`, Gurugram) across the CRM database (`data/crm.sqlite`), backend API endpoints (`server/rm-routes.mjs`), and RM views (`/rm/print-report`, `/rm/team`, `/rm/report-card`).

**Architecture:** 
1. Build and run a deterministic database migration script that updates Anil Jena's profile, links and seeds his 9 Sales Executives with assigned cities, records the exact FY2026-27 monthly and weekly targets and actuals, FY2025-26 previous year monthly actuals, new territory customer records (Chem X Enterprises, S.B. Refractory), and thrust product lines.
2. Update the backend `/rm/print-report` and related RM endpoints to support the complete 9-section feedback report structure (Basic details, Team & Cities, Annual Summary, Monthly Target vs Achievement with variations, Weekly purchases grid, Previous year monthly actuals, Territory expansion, Thrust products).
3. Update the frontend `/rm/print-report` and RM reporting interface to render the high-fidelity report accurately matching the PDF format.
4. Verify with API checks and unit tests.

**Tech Stack:** SQLite, Node.js / Express, Next.js / React, TypeScript, CSS.

---

### Task 1: Database Seed & Migration Script for Anil Jena Real-Time Data
**Files:**
- Create: `scripts/seed_anil_jena_realtime.mjs`
- Test: `scripts/verify_anil_data.mjs`

- [x] **Step 1: Write verification script to test against database**
Create `scripts/verify_anil_data.mjs` that checks for:
- Anil Jena profile (`employee_code = '075709'`, `operating_city = 'Gurugram'`, `reg_code_1 = '2111C126'`, `reg_code_2 = '2111S126'`).
- 9 sales executives reporting to Anil Jena.
- FY2026-27 monthly targets totaling 501.00 Lakh and actuals totaling 114.24 Lakh.
- Weekly purchase records.
- Previous year FY2025-26 monthly actuals totaling 260.43 Lakh.
- New dealers Chem X Enterprises and S.B. Refractory.

- [x] **Step 2: Run verification script to confirm it fails**
Run: `node scripts/verify_anil_data.mjs`
Expected: FAIL (missing fields/data).

- [x] **Step 3: Implement `scripts/seed_anil_jena_realtime.mjs` and execute migration**
- Update `users` and `salesperson_profiles` for Anil Jena (`rm-anil-jena` and `rm-anil-alias`).
- Ensure schema supports registration codes or store in `salesperson_profiles` (or metadata table).
- Seed the 9 Sales Executives: *Sandeep Kumar, Sushil Kumar, Tika Prasad Yadav, Purshottam Sarang, Atal Trevidi, Girand Kumar, Soumya Das, Prashant Jadon, Vikrant Jadon* with their cities and `manager_user_id = 'rm-anil-jena'`.
- Insert/Update `tally_rm_targets` for Anil Jena for FY2026-27 (`2026-04` through `2027-03`) with the exact monthly targets from Section 4.
- Create / update table `rm_weekly_purchases` or weekly achievement stores to hold the exact Wk 1–4 matrix.
- Seed FY2025-26 monthly actuals for Anil Jena.
- Ensure Chem X Enterprises and S.B. Refractory are assigned to Anil Jena with their sales.
- Execute the script against `data/crm.sqlite`.

- [x] **Step 4: Run verification script to confirm it passes**
Run: `node scripts/verify_anil_data.mjs`
Expected: PASS.

---

### Task 2: Backend API Updates in `server/rm-routes.mjs`
**Files:**
- Modify: `server/rm-routes.mjs`
- Test: `scripts/verify_rm_api.mjs`

- [x] **Step 1: Write API test script**
Create `scripts/verify_rm_api.mjs` that queries `/rm/print-report` and validates that the returned payload contains:
- `basicDetails`: RM Name, Code `075709`, City `Gurugram`, Reg codes `2111C126`, `2111S126`.
- `team`: 9 members with their cities.
- `annual`: Current year (501.00, 254.68, 114.24, 45%), Last year (606.00, 308.05, 136.98, 44%).
- `monthly`: Complete 12-month targets, actuals, % achievement, and variations.
- `weekly`: Complete 6-month x 4-week table.
- `previousYear`: 12-month targets and actuals.
- `territoryExpansion`: Chem X Enterprises, S.B. Refractory, 0.09 L visits/expansion figures.
- `thrustProducts`: Listed products with actuals.

- [x] **Step 2: Update `/rm/print-report` endpoint in `server/rm-routes.mjs`**
Enhance the `/print-report` endpoint to return all required 9 sections from the database.

- [x] **Step 3: Run API test to verify it passes**
Run: `node scripts/verify_rm_api.mjs`
Expected: PASS.

---

### Task 3: Frontend Print Report & UI View Updates
**Files:**
- Modify: `src/app/rm/print-report/page.tsx`
- Modify: `src/app/rm/print-report/print.css`

- [x] **Step 1: Update `page.tsx` to display all 9 PDF sections**
- Section 1: Basic Details (RM Name, RM Code 075709, Gurugram, Reg Codes 2111C126 & 2111S126).
- Section 2: Team Mates / Sales Executives with cities.
- Section 3: Annual Summary (Current Year 501.00 / 254.68 / 114.24 / 45%, Last Year 606.00 / 308.05 / 136.98 / 44%).
- Section 4: Monthly Target vs Achievement (Total, Apr–Mar, with Variation row).
- Section 5: Weekly Purchases Table (Wk 1 to Wk 4 by Month, plus totals).
- Section 6: Previous Year Target vs Actual table.
- Section 7: Territory Expansion (Chem X Enterprises, S.B. Refractory, Visits 0.09).
- Section 8: Thrust Products (Zpn Blue 15, Zpn 200, Zpn Black, Shimaclad, Peony, Clearclad, Lcbh, Enilex, Chorme Catalyst, POP, Uviclad 612, Patinas).
- Section 9: Special Targets, Notes, and Visual Chart.

- [x] **Step 2: Polish CSS in `print.css`**
Ensure clean printing styles, high visual fidelity, correct badges, and responsive tables.

- [x] **Step 3: Validate Next.js compile & browser rendering**
Run type-check or Next build / curl verification against `http://localhost:3000/rm/print-report`.

---

### Task 4: Admin RM Detail Dashboard & Metric Synchronization
**Files:**
- Modify: `server/admin.mjs`
- Modify: `src/components/admin/admin-rm-detail.tsx`

- [x] **Step 1: Fix Canonical RM ID Lookup in `server/admin.mjs`**
Ensure alias URLs like `aniljenafield` resolve to canonical `aniljena` profile, avoiding null user resolution and false 0% target calculations.

- [x] **Step 2: Implement Active Ledger Cycle Synchronization**
Anchor reporting calculations to the latest active billing month (e.g. September 2026 / `2026-09`) when future or unbilled calendar dates are queried, ensuring 100% metric consistency across the Performance Status badge (135% On Track), Current Period Milestone (₹62.15 L / 41 invoices), and the 12-Month Target vs Actual chart.

- [x] **Step 3: Add Period-Aware Target Proration**
Prorate targets for *Today* (daily quota = monthly / 30) and *This Week* to avoid comparing single-day billing against full-month quotas.

- [x] **Step 4: Validate with TypeScript & Server Health Checks**
Confirmed `npx tsc --noEmit` exits with 0 errors and `GET /admin/team/aniljenafield` returns `200 OK`.

## Latest local follow-up ? 16 October 2026

No seed, alias merge, Tally import or data migration was rerun. The Admin attendance latency fix reads actual persisted attendance revisions and revalidates relevant views; isolated-snapshot integration checks confirmed canonical Anil RM detail sees checkout updates.

The manual refresh control is absent from login/root pages. Automatic attendance revalidation preserves the current report tab and filters; manual document reload may reset component-only state.

The empty October Sales Reports result follows local billing coverage, not Anil profile visibility: latest invoice `2026-09-08`, 78 September invoices and none for 1?16 October. October billing still needs its normal Tally sync.

These changes and this follow-up remain local/unpublished. Local and live databases continue to be separate.

Release context: [source synchronization and deployment status](../reports/2026-10-16-production-source-sync.md).

> Current project status (19 October 2026): See the [production readiness report](../../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
