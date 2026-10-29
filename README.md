# PSSPL CRM — Enterprise Sales & Accounting Intelligence Platform

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

<!-- oct27-ui-details:start -->
## Latest Overview and RM ranking behavior

Overview hides At a glance, Money / Collections and Planned customer visits; other KPIs and Field activity remain. The Quarter-wise Trend uses dashboard-themed cards. Product Trends rows hide links and percentage/units subtext; Pipeline hides conversion-rate presentation while retaining lead counts. RM report Top Customers / Top Products use actual scoped invoices and the same dashboard/PDF component, with source gaps disclosed. See the latest UI and ranking notes linked above.


Latest follow-up: [Local preview and RM dashboard scope](docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup): **Start Preview / Exit Preview** controls optional Rais Khan sample rows. Empty products receive five examples; a short customer list keeps real rows and appends marked samples to five. Sample customer shares are unavailable and totals remain recorded values. Dashboard/PDF labels match; no persistence occurs. The bottom Monthly target card is hidden for RM accounts only, with the salesperson card retained.
<!-- oct27-ui-details:end -->

## Latest Admin UI — 26 October 2026

- **Product trends:** Sales Performance Trend now uses the native light card, navy heading, subtle axes/gridlines and a white tooltip. Existing blue/green series, FY selection, monthly/quarterly logic, height and interactions remain intact.
- **Sidebar:** Reporting, Reports and Management reports are hidden from the Admin rail. Field operations is followed by Administration; all other items remain. The report pages and backend remain accessible under their existing routes and permissions.
- [Implementation, source files and dated verification](docs/operations/admin-product-trends-and-sidebar.md). No deployment or source-record change is implied.
- **Product comparison recovery:** recorded FY sales/product counts remain intact. When dated YoY evidence is absent, the existing cards, movement lists and product drawer use a clearly labeled MoM baseline. The inspected August/July comparison was ₹6.19 Cr vs ₹3.22 Cr (+91.99%); lifecycle labels refer only to the observed window. Generated `excel-import` invoices remain excluded. [Source findings, unresolved header variance and 22-test verification](docs/operations/admin-product-trends-and-sidebar.md#product-trend-data-and-comparison-recovery).

## Current local workflow - 27 October 2026

- **RM report card and demo view:** FY 2026-27 chart rows include clearly marked display-only sample values for missing months and four-week breakdowns. FY 2025-26 provides a four-week display-only breakdown for every month that reconciles to its existing monthly totals. Rais Khan's five presentation RM Save Entries appear when the selected CRM range is empty, while real entries retain priority. The separate **Actual sales / invoice detail** accordion has been removed. Demo labels have been removed from the Thrust Products cards, and demo explanation copy and the **Future / unverified** legend item are hidden in the attendance section. [Current UI notes](docs/operations/2026-10-27-ui-adjustments.md).
- **Admin Team and Field Activity:** The Team page no longer shows the top info strip or PDF FYTD captions beneath targets. Field Activity keeps Visits and Follow-ups tabs; the Attendance tab and its route-detail table were removed. The Check-ins summary remains.

## Previous local workflow - 24 October 2026

- **Current RM report card:** Manager Action Plan is immediately below the header/FY toolbar, before Performance Overview; AI Insights stays after RM Save Entries. Shared chart legends show smaller `(<100%)` / `(≥100%)` second lines. UI/PDF have complete attendance matrices and a four-column desktop/PDF product grid. PDF uses the eight-column saved-entry table, complete-card pagination and no supporting-detail appendix. FY/month/four-week navigation, verified metrics and existing opt-in local Demo Preview remain intact. [Current implementation and scoped verification](docs/operations/rm-report-finalization.md).
- **Rais Khan client snapshot:** code `033705` receives labeled frontend fallback only for missing fields. Populated values and valid zeros take priority; August Week 2 gets the missing ₹3.11 lakh actual, plus territory expansion and two product names with visually blank unavailable amounts in live mode. Separate explicit local preview can display labeled synthetic metrics. [Preservation audit and source discrepancies](docs/operations/rais-khan-client-snapshot.md).
- **RM My Day saved entries:** a completed visit and its linked order, follow-up and generated lead display in one row; pending route plans stay on My Day. The eight-column table and the thrust-product source are documented in the [original V3 table implementation](docs/operations/rm-performance-v3.md#current-compact-saved-entry-table); current PDF table/order refinements are recorded in [finalization](docs/operations/rm-report-finalization.md#pdf-output).

- **AI:** Ask AI uses the configured Claude provider. The active RM report flow uses Claude to prioritize verified findings; AI Insights and Manager Action Plan use existing vetted templates, with honest rule-based fallback. One live FY verification succeeded; explicit RM name/ID is absent from the current V2 provider payload, although facts/cache are RM-scoped. Backend prompts, model settings and credentials remain unchanged. [AI verification and limits](docs/operations/rm-report-finalization.md#ai-verification-and-limits).
- **Financial sources:** authoritative owner-attributed invoices take priority; supplied RM snapshots provide supported historical aggregates when live FY evidence is absent. Financial and saved-CRM cutoffs remain separate. The earlier V1 Today/This Week preview descriptions below are historical. [Operation and source notes](docs/operations/rm-feedback-snapshots.md).
- **RM percentages and ranking:** actual / positive target, rounded to a whole percentage, without a 100% cap. Missing actuals/targets remain unavailable. Poor to good sorts known achievement ascending, with unknowns last; sales is the fallback only when every achievement is missing. Pradeep's FYTD is 593%, while his annual target achievement is 301% because the denominators differ.
- **Local account cleanup:** the duplicate Anil alias and Vijay Nair were archived at the user's request; retained identities/history remain available through Archived employees. The 12 supplied RM reports remain in the active reporting directory, including RMs without a CRM login.
- **Users & access > Add user:** **Create user** saves without email. **Create user & Send Email** explicitly sends Login ID, email, the admin-entered initial password and all saved employee fields in a professional mobile-friendly email. Existing-account emails support a re-entered, verified current password; stored password hashes cannot be recovered. First-login password changes are optional.
- Gmail SMTP sends from the interim `deepaksingh873785@gmail.com` mailbox using backend-only `.env` credentials. Resend remains selectable. The encrypted durable queue, rate limits, duplicate-status reporting and password/token redaction remain in use; SMTP acceptance is not confirmed inbox delivery.
- Account details can be emailed while the CRM is local, but remote employees still need a reachable CRM with their account database. Unusable localhost links are omitted; usable setup/recovery links are single-use with a 15-minute reset expiry.
- Admin can restore archived employees with new credentials while keeping their CRM history. Attendance provides **View check-in on map** for saved starting coordinates; missing GPS stays **Not captured**.
- Deployment must account for migrations 013 (email provider pinning) and 014 (account notices). Their application must be checked on the target database; this update does not deploy, send email or alter environment values.

Read [current source status](docs/operations/2026-10-21-current-state.md), [Gmail/account email setup](docs/operations/gmail-smtp-authentication.md), [Resend setup](docs/operations/resend-email-authentication.md), and [migration notes](database/migrations/README.md). Recorded older releases below do not establish publication of these local features.

An enterprise CRM and field sales platform specifically designed for **Progressive Surface Systems Pvt. Ltd. (PSSPL)**, integrating Tally accounting data with field sales mobility, Regional Manager oversight, and executive analytics.

## Historical deployment snapshot — 16 October 2026

- Canonical source: `DeepakSingh-gh/psspl`, branch `main`. Last verified Vercel production commit: `87eae1e` (`dpl_8Lqo3dUH9DPXpMFLT4QJGFmtTbgD`).
- Current local landing routes: Admin `/admin`; RM and Salesperson `/sales/my-day`. Existing `/rm` bookmarks redirect to My Day. My Day and Customer DB remain available through the appropriate workspace navigation.
- Admin RM report tabs: **Manager Action Plan** (default), **AI Insights**, **Report Card**, **Customer Visits**, **Pipeline**, **Actual Sales**, **Products**, **Follow-ups**.
- GitHub synchronization and frontend publication are complete. Backend AI-provider and performance code is committed, but its Render rollout is pending live SQLite preservation. The Gemini key was separately saved and verified in Render's environment.
- Vercel automatic Git linking remains blocked by the connected GitHub account's repository permission; the verified releases were created explicitly through the Vercel API. Local and live databases remain separate.
- This documentation refresh is local only: it does not commit, push or deploy changes. See the [source-sync report](./docs/superpowers/reports/2026-10-16-production-source-sync.md) for release evidence and limitations.

### Local-only attendance freshness fix

Admin Overview, Team, RM detail, Field Activity and Alerts now automatically check a lightweight attendance revision every two seconds while visible. A persisted clock-in/out change invalidates the relevant admin cache and refetches current data without resetting selected tabs or filters. Multiple mounted views share one poll; unchanged attendance does not trigger repeated full dashboard queries. Returning to the tab or reconnecting prompts an immediate check. Actual display delay is the polling interval plus network/API time, not a guaranteed two-second deadline.

The admin-only `GET /api/admin/attendance/revision` endpoint returns an opaque fingerprint with `Cache-Control: no-store`. Both the frontend and backend additions must be deployed together in a future release; they are local only now. Tests: `node --test scripts/attendance-live.test.mjs` and `node scripts/verify-attendance-latency.mjs`. The integration check uses an isolated database snapshot and leaves actual attendance records intact.

### Local-only refresh button behavior

App data pages include a fixed **Refresh Data** button, hidden on `/login`, `/` and in print. It reruns registered data loaders and requests a route refresh while preserving local tabs and filters. Admin content reserves bottom clearance so pagination and the refresh button do not overlap. These local changes do not establish production deployment.

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
* **Regional Manager Workspace:** `/rm` (Local: `http://localhost:3000/rm`), with assigned-team dashboards, reports and field-work navigation.
* **Field Sales PWA View:** [https://psspl-crm.vercel.app/sales/my-day](https://psspl-crm.vercel.app/sales/my-day) (Local: `http://localhost:3000/sales/my-day`)
* **Backend API Health:** [https://psspl-crm-backend.onrender.com/api/health](https://psspl-crm-backend.onrender.com/api/health) (Local: `http://localhost:4000/api/health`)

---

## 🔑 Default Roles & Login Credentials

All accounts are pre-seeded in the database for local development and testing:

| Persona | Email | Password | Access & Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@psspl.com` | `psspl-admin-2026` | Full platform access, user management, audit logs, Tally connector, approved scheduled WhatsApp reports, margin approvals. |
| **Regional Manager (Anil Jena)** | `anil.jena@psspl.com` | Existing admin-managed password | Canonical RM Code 075709. The duplicate `anil@psspl.com` alias was archived locally on 21 October 2026; it no longer signs in. Supplied snapshot figures are dated 30 September 2026. |
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
  - **Accurate RM Target & Achievement Engine:** INR-lakh source values convert to rupees once. Shared achievement calculation uses actual / positive target, rounded and uncapped; missing values remain unavailable. Monthly, FYTD and annual comparisons retain their own target denominators.
  - **Strategic Thrust Products — RM Leaderboard (`/admin/team`):** Full cross-team visibility into RM-wise sales of annual strategic thrust chemical products (*Zpn Blue 15, Zpn 200, Zpn Black, Shimaclad Peony, Clearclad Lcbh, Enilex Chrome Catalyst, POP, Uviclad 612, Patinas*), displaying rank medals, total thrust revenue in Lakhs, active product lines sold, and top volume product per RM.
  - **RM Sales Activity & Executive Report Card (`/admin/team/[id]`):** Clicking any RM or salesperson name opens an enhanced, executive-ready 8-tab sales activity dashboard featuring:
    - **Header Identity Badges:** RM Code (e.g. `075709`), territory region, operating city (`Gurugram`), clock-in/out timestamps, and pill tags of **Team Executive Cities** (*Gurgaon, Delhi, Ghaziabad, Faridabad, Noida, Sonepat, Bahadurgarh, Sahibabad, Rudrapur*).
    - **Special Achievements & Milestones:** Vacant box architecture ready for verified performance ledger milestone entries.
    - **Period-aware Sales vs Target Graph:** Month/FYTD show monthly target and actual history. Today shows the selected day's total; This Week shows daily target and actual bars Monday–Saturday. Bar details appear beside the graph while a bar is hovered or focused. Future or blank actuals remain unavailable. For empty Rais Khan Today/This Week records, a separate display-only **Demo** preview shows how live reporting will look.
    - **Source-aware reporting periods:** Supplied monthly reports retain their 30 September 2026 cutoff and distinct monthly/FYTD targets. Today/This Week use operational CRM data; monthly PDF aggregates are not prorated into invented daily or weekly sales. Future or blank actuals remain unavailable.
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

### 2. Regional Manager Workspace (`/rm`)

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

## Historical local status - Phase 7, 17 October 2026

Phase 7 is a **CONDITIONAL PASS** for local implementation: authorized AI evidence selection, approved daily/monthly report scheduling, durable delivery/retry/callback handling, scoped in-app reminders and task-oriented training SOPs. Verification passed 68 automated tests plus the separate My Day smoke check, TypeScript, 29 syntax checks and whitespace validation.

All work remains local and uncommitted on `feature/psspl-phase3-rm-report-cards`. No deployment, existing-database migration, real WhatsApp message or paid provider request was performed. Delivery is disabled by default. Recipients/opt-in/templates/schedules, reviewed provider configuration, backup/migration rollout, data freshness/mapping decisions, browser acceptance and training sign-off remain outstanding. Final UAT has not started and awaits user approval.

- [Phase 7 verification and changed files](./docs/project-records/PSSPL_PHASE7_VERIFICATION.md)
- [Report automation operator runbook](./docs/operations/PSSPL_REPORT_AUTOMATION.md)
- [RM/SE SOP](./docs/training/PSSPL_RM_SE_SOP.md)
- [RM/Manager SOP](./docs/training/PSSPL_RM_Manager_SOP.md)
- [Admin SOP](./docs/training/PSSPL_Admin_SOP.md)

<!-- rm-report-current:start -->
## Historical RM report card - 22-10-2026

- Select an RM (Admin only), Weekly / Monthly / Yearly, financial year, month and week as applicable. Press **View Report** to apply and open the Report Card tab. RM accounts remain restricted to their authorized data.
- Desktop filters are compact; Insights/actions appear side by side directly below Technical Service, followed by KPIs and chart, with stacked mobile sections. PDF retains two A4 pages.
- **Download PDF** also applies pending filters, opens the matching preview and saves from its download button. Export errors provide a retry message; filenames use selected-period dates.
- Executive Territory Coverage groups each executive with their cities beneath the profile and on PDF page 2. The supplied-report date is visible; dealer locations are not substituted as executive assignments.
- Rais Khan reuses existing supplied monthly/weekly/yearly financial data when live invoices are absent; separately labeled sample details remain a documented presentation exception. Missing source achievements stay unavailable. Other RMs receive no sample fallback.
- Latest local checks: all 5 dynamic-period tests, TypeScript and changed-file whitespace checks passed, including dashboard/PDF mapping parity and PDF footer fit.

See [period rules, source limitations and verification](docs/operations/rm-period-reports.md) and [other UI/loading changes](docs/operations/2026-10-22-ui-and-performance.md). The proposed Claude Call Sheet image is a preview, not an implemented feature set. No production deployment or production-data modification was performed for these updates.
<!-- rm-report-current:end -->
