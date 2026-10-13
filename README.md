# PSSPL CRM — Enterprise Sales & Accounting Intelligence Platform

An enterprise CRM and field sales platform specifically designed for **Progressive Surface Systems Pvt. Ltd. (PSSPL)**, integrating Tally accounting data with field sales mobility, Regional Manager oversight, and executive analytics.

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
Requirements: Node.js 22 or newer and npm. The CRM uses a local SQLite file, so external services are not required for local development.

```bash
git clone https://github.com/Khushi-Bizgenix/psspl.git
cd psspl
npm install
cp .env.example .env
npm run db:setup
npm run dev
```
*(On Windows Command Prompt, use `copy .env.example .env` instead of `cp`)*.

---

### 3. Live Application Portals
* **Main App & Login:** [http://localhost:3000](http://localhost:3000)
* **Executive Admin Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin)
* **Regional Manager Portal:** [http://localhost:3000/rm](http://localhost:3000/rm)
* **Field Sales PWA View:** [http://localhost:3000/field](http://localhost:3000/field) or [http://localhost:3000/sales/my-day](http://localhost:3000/sales/my-day)
* **Backend API Health:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔑 Default Roles & Login Credentials

All accounts are pre-seeded in the database for local development and testing:

| Persona | Email | Password | Access & Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@psspl.com` | `psspl-admin-2026` | Full platform access, user management, audit logs, Tally connector, EOD WhatsApp summaries, margin approvals. |
| **Regional Manager (Anil Jena)** | `anil.jena@psspl.com` / `anil@psspl.com` | `psspl-rm-2026` | North Region (Operating from Gurugram), RM Code: 075709, Registration: 2111C126 / 2111S126, 9 Executive Team members, real-time PDF target feedback support (501 L target / 114.24 L achieved). |
| **Regional Manager (Ketan Bhatt)** | `ketan.bhatt@psspl.com` / `ketan@psspl.com` | `psspl-rm-2026` | West Region, key accounts (Protec Finish, etc.), regional product comparison. |
| **Field Sales Executive** | `anil.jaina@psspl.com` | `demo123` | Mobile-first day planner, GPS check-in/out, visit logging, voice notes, lead pipeline with inline deletion, order requests. |

---

## 📊 Real Client Dataset & Ingestion

The CRM is loaded with actual client records imported from client workbooks and executive target schedules:

* **171 Customers & Dealers:** Protec Finish Innovators, Metfin Systems, Schneider Electric, Chem X Enterprises, S.B. Refractory, etc., including city mappings, destination codes, and outstanding balances.
* **666 PSS Chemical Products:** Complete catalog with packing sizes, UOM (Kgs., Ltrs., Nos.), rates, and historical sales.
* **868 Real Invoices & 1,730 Product Lines:** Totaling **Rs 35.47 Crore** in sales, backing all executive charts and customer history.
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
    - **Period Controls:** Seamless switching between *Today*, *This Week*, *This Month*, and *FYTD*.
  - **Quotations & Margin Approvals:** Multi-level approval matrix for discounts and sub-margin pricing.
  - **Reports & EOD WhatsApp Summary:** Filterable management reports with one-click **PDF Print** (A4 optimized via `print.css`), **Excel/CSV Export**, and direct **WhatsApp sharing**.
  - **Tally Live Connector:** Pairing codes, rotating HMAC tokens, heartbeat monitoring, chunked session imports, and persistent high-contrast Disconnect action button.
  - **Supabase Cloud Sync Engine (GI Connector):** Automatic real-time background sync (`server/supabase-sync.mjs`) pushes all new Tally data directly to an external Supabase Postgres database. Uses advanced Upsert (`ON CONFLICT DO UPDATE`) logic to prevent data overlap while maintaining local SQLite speed.
  - **Quarter-wise Trend Analysis:** Visual progress-bar dashboard comparing Q1-Q4 (Apr-Mar Financial Year) revenue performance directly on the admin overview.
  - **High-Performance Query & In-Memory Batch Engine:**
    - Composite database indexing (`idx_tally_customers_rm_name`, `idx_tally_invoices_session_date`, `idx_tally_invoice_lines_inv_prod`, `idx_tally_rm_product_sales_rm`) eliminates full table scans across 53,000+ invoices and invoice lines.
    - Single-pass `calculateAllThrustProductsBatch()` aggregates all cross-team chemical thrust lines in memory in ~200ms instead of executing 330+ nested SQL queries, slashing API response time by 8× (~450ms vs 3.6s+).
    - Client-side Stale-While-Revalidate (SWR) cache (`useAdminData`) provides instant zero-latency view switching with background revalidation and namespaced cache keys.
  - **Audit Logging & Security:** Detailed tracking of logins, password resets, user creations, and export actions.

### 2. Regional Manager Portal (`/rm`)
- **Manager-Scoped Dashboard & Executive Identity:** Automatic scoping to team members and regional customers. Displays full executive profile parity with the Admin panel:
  - **Header Identity Badges:** Clean executive hero banner displaying RM Code (`075709`), `📍 Operating from: Gurugram`, live attendance Clock-in & Clock-out actions with real-time status pills, and all 9 **Team Executive Cities** (*Gurgaon, Delhi, Ghaziabad, Faridabad, Noida, Sonepat, Bahadurgarh, Sahibabad, Rudrapur*). Streamlined navigation with redundant region tabs removed for a modern look.
  - **Interactive Attendance & Quick Actions:** Fully functional Clock-in / Clock-out flow updating attendance in real-time, plus quick modal triggers for adding unplanned customer visits.
  - **Clean Executive Overview:** Clean, distraction-free home dashboard focused on core operational metrics (Team Sales, Customers, Outstanding, Active Leads, Top Products), with full separation from specialized standalone report-generation views.
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

### 3. Field Sales PWA Workspace (`/field` / `/sales/my-day`)
- **Day Planner & GPS Attendance:** One-tap GPS check-in and check-out with time and route tracking. Clock-in and clock-out timestamps are persisted and displayed on both sales and manager dashboards.
- **Metric Cards & Order Tracking:** Live tracking of daily visits, completion status, **Order Expected** value (in Lakhs), and target achievement.
- **Harmonized Monthly Performance Review:** "MY PERFORMANCE - Monthly target" card accurately displays live rupee metrics (`Actual from Tally`, `Target`, `Gap`) using standardized Indian currency formatting (`formatRupees`) in perfect agreement with top-line metrics (e.g. ₹62.15 L / ₹45.93 L / 135%).
- **Dual-Mode Follow-ups System (Visit & Call):** Action list follow-ups supporting channel selection (**🚗 Field Visit** vs **📞 Phone Call**), priority tagging (`High`, `Medium`, `Low`) with color-coded badges, and editable priority dropdowns. Interactive **Discussion Description Boxes** feature Honolulu Blue border styling (`1.5px solid #007CBA`), focus halo ring, left-accented notes display (`.followup-notes-display`), and fully editable **Next Follow-up due dates**.
- **Customer Visits & Modal Experience:**
  - Robust **Add Unplanned Visit** modal tied directly to active reference customers with synchronized multi-tier access control (allowing RMs and field sales representatives to plan visits across all customers in their territory, assigned accounts, and subordinates).
  - Instant synchronization between Field Sales Workspace and Admin Panel (`/admin/team/[id]`): visits planned by RMs or field sales reps immediately reflect on the manager's report card under *Customer Visits* and daily KPIs.
  - Custom **`AnimatedSelect`** dropdown with silky-smooth cubic-bezier open/close transitions, rotating chevron, and focus rings.
  - Quick visit logging with operational tags, date/time selection, priority level tracking, clearly delineated field input borders on Unplanned Visit dialogs, and built-in **audio voice note recording**.
  - Includes full inline Edit and Delete capabilities for Unplanned Visits on the workspace with form state auto-reset.
- **Regional Manager Detail & Report Card (`/admin/team/[id]`):** Streamlined executive view with real-time profile hero (RM Code, operating city, clock-in/out timestamps, target status), compact territory coverage pills, responsive milestones strip, 12-month target vs actual comparative bar charts, top dealers, customer health risks, and automated AI managerial action plans.
- **Service & Support Requests:** Track customer complaints, technical trials, and commercial quotation requests.

### 4. AI Executive Intelligence & Copilot
- **Global Header AI Ask Copilot:** Accessible on every page header (`topbar`) with a glowing search bar, shortcut `[Ctrl + K]`, and a prominent gradient **Search AI** button.
- **Executive Card Formatting (`AiResponseFormatter`):** Converts raw LLM output into structured **Executive Action Cards** with blue **Data Point** badges, green **Recommended Action** boxes, and inline currency/count metric pills (`askai-metric-pill`).
- **Instant Query Execution:** Clicking suggested prompt chips immediately fills the input and triggers live database intelligence retrieval.
- **One-Click Copy & Data Provenance:** Integrated **Copy** button with instant state feedback and live SQL data provenance details.
- **Grounded SQL Data Engine:** Context synthesized directly from real-time database tables (`tally_invoices`, `tally_products`, `tally_customers`, `leads`, `follow_ups`, `salesperson_profiles`).
- **Resilient AI Model Engine:** Connected via **Google Gemini API** (`gemini-3.8-flash`, `gemini-3.6-flash`) via `GEMINI_API_KEY` with low-latency direct reasoning (with fallback to OpenAI `gpt-4o-mini`).
- **Voice Speech-to-Text Search (`<VoiceMicButton>`):** Reusable voice recording mic button integrated on all search boxes across Sales Hub, Ask AI, RM Directory, Admin Customers, and Admin Products. Supports instant free browser Web Speech API with backend OpenAI Whisper API (`POST /api/stt`) fallback.
- **Automated 5:00 PM EOD Cron:** Built with `node-cron` in `server/app.mjs`, compiling daily visits, order booking, and attendance into a WhatsApp digest sent via Meta WhatsApp Cloud API.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory to customize configuration and API keys:

```ini
# Server & API Configuration
PORT=4000
CRM_ADMIN_EMAIL=admin@psspl.com
CRM_ADMIN_PASSWORD=psspl-admin-2026
CRM_DATABASE_PATH=./data/crm.sqlite

# Google Gemini API Integration (Ask AI Assistant)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI Integration (Optional Fallback)
OPENAI_API_KEY=your_openai_api_key_here

# Meta WhatsApp Cloud API (Automated EOD & Report Sharing)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_meta_system_user_token
WHATSAPP_RECIPIENT_PHONE=919876543210
```

---

## 🧪 Verification & Testing Commands

* **Run Lint / Build:** `npm run build`
* **Test Dev Server:** `npm run dev`
* **Run Data Importer:** `npm run import:data`
* **Backend Health Check:** `curl http://localhost:4000/api/health`

