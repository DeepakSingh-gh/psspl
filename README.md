# PSSPL CRM — Enterprise Sales & Accounting Intelligence Platform

An enterprise CRM and field sales platform specifically designed for **Progressive Surface Systems Pvt. Ltd. (PSSPL)**, integrating Tally accounting data with field sales mobility, Regional Manager oversight, and executive analytics.

## Current release status — 16 October 2026

- Canonical source: `DeepakSingh-gh/psspl`, branch `main`. Last verified Vercel production commit: `87eae1e` (`dpl_8Lqo3dUH9DPXpMFLT4QJGFmtTbgD`).
- RM and salesperson sign-ins open `/sales/my-day`; `/rm` redirects there. The shared sidebar contains **My Day** and **Customer DB**. Admin sign-in still opens `/admin`.
- Admin RM report tabs: **Manager Action Plan** (default), **AI Insights**, **Report Card**, **Customer Visits**, **Pipeline**, **Actual Sales**, **Products**, **Follow-ups**.
- GitHub synchronization and frontend publication are complete. Backend AI-provider and performance code is committed, but its Render rollout is pending live SQLite preservation. The Gemini key was separately saved and verified in Render's environment.
- Vercel automatic Git linking remains blocked by the connected GitHub account's repository permission; the verified releases were created explicitly through the Vercel API. Local and live databases remain separate.
- This documentation refresh is local only: it does not commit, push or deploy changes. See the [source-sync report](./docs/superpowers/reports/2026-10-16-production-source-sync.md) for release evidence and limitations.

### Local-only attendance freshness fix

Admin Overview, Team, RM detail, Field Activity and Alerts now automatically check a lightweight attendance revision every two seconds while visible. A persisted clock-in/out change invalidates the relevant admin cache and refetches current data without resetting selected tabs or filters. Multiple mounted views share one poll; unchanged attendance does not trigger repeated full dashboard queries. Returning to the tab or reconnecting prompts an immediate check. Actual display delay is the polling interval plus network/API time, not a guaranteed two-second deadline.

The admin-only `GET /api/admin/attendance/revision` endpoint returns an opaque fingerprint with `Cache-Control: no-store`. Both the frontend and backend additions must be deployed together in a future release; they are local only now. Tests: `node --test scripts/attendance-live.test.mjs` and `node scripts/verify-attendance-latency.mjs`. The integration check uses an isolated database snapshot and leaves actual attendance records intact.

### Local-only refresh button behavior

App data pages include a fixed **Refresh Data** button (hidden on `/login` and the root redirect page) at the bottom-right, provided by the root layout. It reloads the current URL, clears the in-memory admin cache through the reload and reruns page data requests. Unsaved input and component-only tab/filter selections can reset. The button is responsive, keyboard accessible, disabled after activation and hidden in printed documents. This feature has not been pushed or deployed; TypeScript and local route checks passed; login renders without the control, while admin RM detail, My Day and Customer DB retain it.

## My Day loading performance — 16 October 2026

Source synchronization and production frontend release procedure: [16 October source-sync report](./docs/superpowers/reports/2026-10-16-production-source-sync.md). The canonical user-owned repository is `DeepakSingh-gh/psspl`, production branch `main`; local secrets and databases are not part of source synchronization.

The My Day API now filters customers before joining invoice lines, reuses one RM directory per request, and compresses large responses. Sales navigation uses Next.js links. The response fields, complete product list, permissions and activity workflows are preserved, without adding cross-request data caching.

Local verification: all 25 tested scopes matched the previous product totals; aggregate query time decreased from 3,980 ms to 161 ms. Actual RM/salesperson HTTP responses decreased from approximately 2.40 MB to 410 KB with gzip (83% smaller), with identical decoded JSON. These are local measurements, not a guarantee of live page timings.

Run `node scripts/verify-my-day-performance.mjs` for ledger comparisons and `node scripts/verify-my-day-http.mjs` against the local API on port 4000 for compression/authentication checks. The HTTP check creates and removes temporary test sessions.

The live Render service was confirmed to use Free compute. Its [idle spin-down behavior](https://render.com/docs/free#spinning-down-on-idle) can still add about a minute after 15 minutes without traffic. The frontend changes are published; backend query/compression changes still await a separate Render rollout. Preserve live SQLite data before that rollout: the current Free service uses an ephemeral filesystem.

---

## 🌐 Live Production Deployment

* **Production Web App (Vercel):** [https://psspl-crm.vercel.app](https://psspl-crm.vercel.app)
* **Backend API (Render):** [https://psspl-crm-backend.onrender.com/api/health](https://psspl-crm-backend.onrender.com/api/health)
* **GitHub Repository:** [https://github.com/DeepakSingh-gh/psspl](https://github.com/DeepakSingh-gh/psspl)

---

## 🚀 Quick Start

### 1. Installation & Running
```bash
# Install dependencies
npm install

# Setup database migrations and seeds
npm run db:setup

# Start development servers (Next.js on 3000 + Express API on 4000)
npm run dev
```

### 2. Local setup for teammates
Requirements: Node.js 22 or newer and npm. The CRM uses a local SQLite file with automated gzip baseline initialization (`data/crm-baseline.sqlite.gz`), so external databases are not required for local development.

```bash
git clone https://github.com/DeepakSingh-gh/psspl.git
cd psspl
npm install
cp .env.example .env
npm run db:setup
npm run dev
```
*(On Windows Command Prompt, use `copy .env.example .env` instead of `cp`)*.

---

### 3. Application Portals
* **Main App & Login:** [https://psspl-crm.vercel.app/login](https://psspl-crm.vercel.app/login) (Local: `http://localhost:3000/login`)
* **Executive Admin Dashboard:** [https://psspl-crm.vercel.app/admin](https://psspl-crm.vercel.app/admin) (Local: `http://localhost:3000/admin`)
* **Regional Manager & Field Workspace:** [My Day](https://psspl-crm.vercel.app/sales/my-day) and [Customer DB](https://psspl-crm.vercel.app/sales/hub) (Local: `http://localhost:3000/sales/my-day` and `/sales/hub`). The legacy `/rm` entry redirects to My Day.
* **Field Sales PWA View:** [https://psspl-crm.vercel.app/sales/my-day](https://psspl-crm.vercel.app/sales/my-day) (Local: `http://localhost:3000/sales/my-day`)
* **Backend API Health:** [https://psspl-crm-backend.onrender.com/api/health](https://psspl-crm-backend.onrender.com/api/health) (Local: `http://localhost:4000/api/health`)

---

## 🔑 Default Roles & Login Credentials

All accounts are pre-seeded in the database for local development and testing:

| Persona | Email | Password | Access & Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@psspl.com` | `psspl-admin-2026` | Full platform access, user management, audit logs, Tally connector, approved scheduled WhatsApp reports, margin approvals. |
| **Regional Manager (Anil Jena)** | `anil.jena@psspl.com` / `anil@psspl.com` | `psspl-rm-2026` | North Region (Operating from Gurugram), RM Code: 075709, Registration: 2111C126 / 2111S126, 9 Executive Team members, real-time PDF target feedback support (501 L target / 114.24 L achieved). |
| **Regional Manager (Ketan Bhatt)** | `ketan.bhatt@psspl.com` / `ketan@psspl.com` | `psspl-rm-2026` | West Region, key accounts (Protec Finish, etc.), regional product comparison. |
| **Field Sales Executive** | `anil.jaina@psspl.com` | `demo123` | Mobile-first day planner, GPS check-in/out, visit logging, voice notes, lead pipeline with inline deletion, order requests. |

---

## 📊 Real Client Dataset & Ingestion

The CRM is loaded with actual client records imported from client workbooks and executive target schedules:

* **171 Customers & Dealers:** Protec Finish Innovators, Metfin Systems, Schneider Electric, Chem X Enterprises, S.B. Refractory, etc., including city mappings, destination codes, and outstanding balances.
* **666 PSS Chemical Products:** Complete catalog with packing sizes, UOM (Kgs., Ltrs., Nos.), rates, and historical sales.
* **868 Real Invoices & 1,730 Product Lines:** Totaling **Rs 35.47 Crore** in sales, backing all executive charts and customer history.
* **Live Tally Ingestion Pipeline:** Real-time collection receipts (`tally_payments_live`), raw material procurement vouchers (`tally_purchases`, `tally_purchase_lines`), and chunked session state tracking (`tally_import_metadata`).
* **12 Regional Managers & 144 Monthly Targets:** Full target tracking across all 12 zones, plus exact **FY 2026-27 Target Feedback Support schedule (501.00 Lakh target)** for Anil Jena (North Region / Gurugram).
* **1,896 RM Product Sales Comparison Records:** FY 2024-25 vs FY 2025-26 volume and value comparisons.
* **48 Field Sales Executives:** Mapped under their respective Regional Managers, including Anil Jena's 9 Gurugram team members.

### Re-running the Data Importer & RM Seeder
To reload or refresh data from Excel workbooks or seed Anil Jena's real-time PDF metrics at any time:
```bash
# Using npm script for general Excel workbooks:
npm run import:data

# Or seeding Anil Jena real-time target feedback data:
node scripts/seed_anil_jena_realtime.mjs
```

---

## 🛠️ Implemented Architecture & Features

### 🎨 Progressive Surface Systems (PSS) Official Brand Palette & Logo
The CRM dashboard features the official PSS corporate visual identity:
- **Corporate Brand Logo (`<PssplLogo />`):** Transparent vector logo component (`src/components/common/psspl-logo.tsx`) featuring the iconic hexagonal laboratory flask, blue chemical liquid accent, and bold PSSPL typography, designed to seamlessly blend with dark navy (`#142742`) navigation sidebars, executive dashboards, and authentication portals.
- **Primary Brand & Active Navigation:** Honolulu Blue (`#007CBA`)
- **AI Assistant & AI Highlights:** Voluptuous Violet (`#7A00DF`)
- **Errors, Warnings & Overdue Indicators:** Love Goddess (`#CC1818`)
- **Success Metrics & Won Pipeline Deals:** Exhilarating Green (`#7CC68D`)
- **Borders & Dividers:** Steam (`#DDDDDD`)
- **Typography & Icons:** Black (`#000000`)

### 1. Executive Admin Dashboard (`/admin`)
- **Revenue & Territory Intelligence:** Total sales, collection status, territory breakdown, top-performing chemical products.
  - **Actionable Team Dashboard & Traffic Light Badging:** RMs auto-sorted by achievement percentage, featuring high-definition two-line stacked layouts with traffic-light-colored pill badges (🔴 Needs Attention <50%, 🟡 Average 50-80%, 🟢 Good >80%) for optimum UI readability.
  - **Sticky Table Headers on Scroll (`/admin/team`):** RM table column headings (`Salesperson / RM`, `Sales`, `Thrust Sales`, `Target`, `Achieved`, `Vs last year`, `Customers`, `Outstanding`, `Top product`, `CRM activity`, `CRM account`) are pinned with sticky headers (`top: 0`, `z-index: 10`) inside a scrollable container (`max-height: calc(100vh - 160px)`), remaining permanently visible as users scroll down.
  - **Accurate RM Target & Achievement Engine:** Native Lakhs-to-Rupees scaling and deterministic synchronization with `tally_rm_targets` and salesperson profiles across all RMs (preventing 100x target inflation bugs and ensuring exact achievement percentages, e.g. Anil Jena at 280% on ₹14.02 Cr sales against ₹5.01 Cr target).
  - **Strategic Thrust Products — RM Leaderboard (`/admin/team`):** Full cross-team visibility into RM-wise sales of annual strategic thrust chemical products (*Zpn Blue 15, Zpn 200, Zpn Black, Shimaclad Peony, Clearclad Lcbh, Enilex Chrome Catalyst, POP, Uviclad 612, Patinas*), displaying rank medals, total thrust revenue in Lakhs, active product lines sold, and top volume product per RM.
  - **RM Sales Activity & Executive Report Card (`/admin/team/[id]`):** Clicking any RM or salesperson name opens an enhanced, executive-ready 8-tab sales activity dashboard featuring:
    - **Header Identity Badges:** RM Code (e.g. `075709`), territory region, operating city (`Gurugram`), clock-in/out timestamps, and pill tags of **Team Executive Cities** (*Gurgaon, Delhi, Ghaziabad, Faridabad, Noida, Sonepat, Bahadurgarh, Sahibabad, Rudrapur*).
    - **Special Achievements & Milestones:** Vacant box architecture ready for verified performance ledger milestone entries.
    - **Monthly Sales Target vs Achievement Visual Graph:** Interactive dual-bar chart comparing all 12 financial year months (Apr-Mar) with actual invoice billing, monthly targets, percentage achievement badges, and surplus/shortfall indicators.
    - **Active Ledger Cycle Synchronization & Period Proration:** Intelligent synchronization with the active ERP reporting cycle (e.g. September 2026 / 135% achieved). When viewing future or unbilled calendar months, it seamlessly anchors to the latest closed cycle to maintain 100% agreement between the Performance Status badge, Current Period Milestone, and 12-Month Target vs Actual graph. Features period-aware target proration for *Today* (Daily quota = Monthly / 30) and *This Week* to prevent misleading 0% underperforming warnings on single days.
    - **Canonical RM ID Resolution:** Unified routing supporting both canonical and alias keys (`aniljenafield` ↔ `aniljena`) ensuring 100% reliable salesperson profile and target quota retrieval.
    - **Strategic Thrust Products Card:** Instant breakdown of the RM's performance across company-designated strategic thrust products with revenue, Lakhs, volume, and customer reach.
    - **Dedicated Manager Action Plan Tab (`📋 Manager Action Plan`):** Extracted from AI insights into its own standalone executive tab, highlighting Target Gap Directives, Territory Focus, Portfolio Concentration Risk (Top 5 dealer dependency % with >80% threshold warnings), and a compact, scrollable log of recent field visit notes and customer outcomes.
    - **KPI Cards:** Completed visits, customers covered, expected orders value, actual Tally sales, FY target achievement %, and open follow-ups.
    - **8 Scoped Tabs:** *Performance* (Target vs Actual gap & daily activity), *Customer Visits* (detailed visit log with outcomes and notes), *Pipeline* (open expected orders with overdue alerts), *Actual Sales* (Tally invoice drill-down), *Products* (product volume & revenue ranking), *Follow-ups* (due dates & priority levels), *Manager Action Plan* (executive guidance, risk, and recent field interactions), and *AI Insight* (automated sales summary).
    - **Period Controls & Temporal Visit Filtering:** Seamless switching between *Today*, *This Week*, *This Month*, and *FYTD*. All customer visit logs and activity queries are dynamically filtered strictly within the selected date window.
    - **Direct Report Preview & Download Feature (`⬇ Download Report`):** Prominent green action button in the report card header. Clicking immediately opens an interactive **In-Page Report Preview Modal** right over the current screen without opening any new tab or navigating to a new page. Displays the complete strict 2-page executive A4 report in high fidelity:
      - **Page 1:** Sales Overview, 8 KPI Badges, **Impactful 12-Month Target vs Achievement SVG Dual-Bar Graph** (rendered natively in vector SVG with gridlines, quota bars, actual billing bars, and % badges without external chart bloat), and Top Customers & Products.
      - **Page 2:** **AI Executive Diagnostic & Field Intelligence**, **Manager Action Plan & Supervisory Directives**, Recent Field Visits, and Open Follow-ups.
      - Features a direct **Download PDF** button in the preview header utilizing direct page-by-page `jsPDF` + `html2canvas` rendering to instantly save a clean 2-page PDF `<RM_Name>_RM_Report_<Date>.pdf` directly into the downloads folder with zero blank pages.
  - **Quotations & Margin Approvals:** Multi-level approval matrix for discounts and sub-margin pricing.
  - **Reports & Scheduled WhatsApp Summaries:** Filterable management reports with one-click **PDF Print** (A4 optimized via `print.css`), **Excel/CSV Export**, and approved recipient-specific **WhatsApp scheduling**. External delivery is disabled by default; the legacy direct-send action is blocked.
  - **Tally Live Connector:** Pairing codes, rotating HMAC tokens, heartbeat monitoring, chunked session imports, and persistent high-contrast Disconnect action button.
  - **Supabase Cloud Sync Engine (GI Connector):** Automatic real-time background sync (`server/supabase-sync.mjs`) pushes all new Tally data directly to an external Supabase Postgres database. Uses advanced Upsert (`ON CONFLICT DO UPDATE`) logic to prevent data overlap while maintaining local SQLite speed.
  - **Quarter-wise Trend Analysis:** Visual progress-bar dashboard comparing Q1-Q4 (Apr-Mar Financial Year) revenue performance directly on the admin overview.
  - **High-Performance Query & In-Memory Batch Engine:**
    - Composite database indexing (`idx_tally_customers_rm_name`, `idx_tally_invoices_session_date`, `idx_tally_invoice_lines_inv_prod`, `idx_tally_rm_product_sales_rm`) eliminates full table scans across 53,000+ invoices and invoice lines.
    - Single-pass `calculateAllThrustProductsBatch()` aggregates all cross-team chemical thrust lines in memory in ~200ms instead of executing 330+ nested SQL queries, slashing API response time by 8× (~450ms vs 3.6s+).
    - Client-side Stale-While-Revalidate (SWR) cache (`useAdminData`) provides instant zero-latency view switching with background revalidation and namespaced cache keys.
  - **Audit Logging & Security:** Detailed tracking of logins, password resets, user creations, and export actions.

### 2. Regional Manager Workspace (`/sales/my-day`; legacy `/rm` redirects)

The current RM landing is the shared My Day / Customer DB workspace. The manager dashboard and specialized reporting capabilities described below remain in the codebase, but the separate team dashboard is no longer the RM home page. Admins continue to review regional team performance through `/admin/team` and `/admin/team/[id]`.
- **Manager-Scoped Dashboard & Executive Identity:** Automatic scoping to team members and regional customers. Displays full executive profile parity with the Admin panel:
  - **Header Identity Badges:** Clean executive hero banner displaying RM Code (`075709`), `📍 Operating from: Gurugram`, live attendance Clock-in & Clock-out actions with real-time status pills, and all 9 **Team Executive Cities** (*Gurgaon, Delhi, Ghaziabad, Faridabad, Noida, Sonepat, Bahadurgarh, Sahibabad, Rudrapur*). Streamlined navigation with redundant region tabs removed for a modern look.
  - **Interactive Attendance & Quick Actions:** Fully functional Clock-in / Clock-out flow updating attendance in real-time, plus quick modal triggers for adding unplanned customer visits.
  - **Daily Home:** My Day provides check-in/out, daily visits, follow-ups and monthly performance. Team overview remains available through admin reporting; it is not the RM sign-in landing page.
  - **Active Ledger Cycle Synchronization:** Automatic alignment with the active ledger month (`2026-09`), displaying ₹45.93 L quota, ₹62.15 L booked sales, and green `On Track (135% achieved)` status badge.
- **Team Accountability & Targets:** Real-time visibility into executive visits, achievement vs monthly targets, and overdue alerts.
- **RM Sales Target Feedback Support Report (`/rm/print-report`):** Exact high-fidelity replication of official company feedback support PDF schedules. Features:
  - Header identity with registration codes (1: `2111C126`, 2: `2111S126`), RM Code `075709`, operating headquarters Gurugram.
  - Complete 9 Sales Executives team grid with designated cities and Tech Services center/executive pairing.
  - Annual Summary (Current Year 501.00 Lakh target / 114.24 Lakh achieved vs Last Year 606.00 Lakh).
  - 12-Month Target vs Achieved matrix with % achievements and variation rows.
  - 4-Week Purchases matrix breakdown across months with weekly target splits (125.25 Lakh per week bucket).
  - Thrust Products tracking with exact YTD sales (Patinas 0.09 L).
  - Full print & PDF styling optimized for A4 landscape export.
- **Dormant Dealer Reports:** Automatic AI-driven flagging of customers with no purchases in >3 months (90 days). Includes built-in input forms for RMs to record and save justification logs directly to the database.
- **Product Growth Trends:** Multi-year product comparison (FY 2024-25 vs FY 2025-26) to detect lost or growing chemical accounts.

Remaining architecture, environment, and verification details: [README continued](./docs/project-records/README_GUIDE_CONTINUED.md).

## Current local status - Phase 7, 17 October 2026

Phase 7 is a **CONDITIONAL PASS** for local implementation: authorized AI evidence selection, approved daily/monthly report scheduling, durable delivery/retry/callback handling, scoped in-app reminders and task-oriented training SOPs. Verification passed 68 automated tests plus the separate My Day smoke check, TypeScript, 29 syntax checks and whitespace validation.

All work remains local and uncommitted on `feature/psspl-phase3-rm-report-cards`. No deployment, existing-database migration, real WhatsApp message or paid provider request was performed. Delivery is disabled by default. Recipients/opt-in/templates/schedules, reviewed provider configuration, backup/migration rollout, data freshness/mapping decisions, browser acceptance and training sign-off remain outstanding. Final UAT has not started and awaits user approval.

- [Phase 7 verification and changed files](./docs/project-records/PSSPL_PHASE7_VERIFICATION.md)
- [Report automation operator runbook](./docs/operations/PSSPL_REPORT_AUTOMATION.md)
- [RM/SE SOP](./docs/training/PSSPL_RM_SE_SOP.md)
- [RM/Manager SOP](./docs/training/PSSPL_RM_Manager_SOP.md)
- [Admin SOP](./docs/training/PSSPL_Admin_SOP.md)

> Current project status (19 October 2026): See the [production readiness report](PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
