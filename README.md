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
| **Regional Manager (Anil Jena)** | `anil.jena@psspl.com` / `anil@psspl.com` | `psspl-rm-2026` | North Region, 17+ dealers, territory analytics, team performance vs targets, product trends. |
| **Regional Manager (Ketan Bhatt)** | `ketan.bhatt@psspl.com` / `ketan@psspl.com` | `psspl-rm-2026` | West Region, key accounts (Protec Finish, etc.), regional product comparison. |
| **Field Sales Executive** | `anil.jaina@psspl.com` | `demo123` | Mobile-first day planner, GPS check-in/out, visit logging, voice notes, lead pipeline, order requests. |

---

## 📊 Real Client Dataset & Ingestion

The CRM is loaded with actual client records imported from client workbooks:

* **171 Customers & Dealers:** Protec Finish Innovators, Metfin Systems, Schneider Electric, Shree Gurukrupa, Vignesh Enterprises, etc., including city mappings, destination codes, and outstanding balances.
* **666 PSS Chemical Products:** Complete catalog with packing sizes, UOM (Kgs., Ltrs., Nos.), rates, and historical sales (ACID CU SLT, SILVER POTASSIUM CYANIDE, ULTEC 3005, ANTHRACITE, etc.).
* **868 Real Invoices & 1,730 Product Lines:** Totaling **Rs 35.47 Crore** in sales, backing all executive charts and customer history.
* **12 Regional Managers & 144 Monthly Targets:** Full FY 24-25 target tracking across all 12 zones.
* **1,896 RM Product Sales Comparison Records:** FY 2024-25 vs FY 2025-26 volume and value comparisons.
* **39 Field Sales Executives:** Mapped under their respective Regional Managers.

### Re-running the Data Importer
To reload or refresh data from Excel workbooks at any time:
```bash
# Using npm script:
npm run import:data

# Or directly using Python:
py -3.11 scripts/import_psspldata.py "<your-data-directory>"
```

---

## 🛠️ Implemented Architecture & Features

### 1. Executive Admin Dashboard (`/admin`)
- **Revenue & Territory Intelligence:** Total sales, collection status, territory breakdown, top-performing chemical products.
  - **Actionable Team Dashboard & Traffic Light Badging:** RMs auto-sorted by achievement percentage (lowest target achievement first to surface underperforming RMs immediately), featuring a high-definition two-line stacked flex layout with traffic-light-colored pill badges (🔴 Needs Attention <50%, 🟡 Average 50-80%, 🟢 Good >80%) for optimum UI readability, styled without distracting underline link hover artifacts.
  - **RM Sales Activity & Executive Report Card (`/admin/team/[id]`):** Clicking any RM or salesperson name opens a comprehensive 7-tab sales activity dashboard featuring:
    - **Dynamic Manager Action Plan:** Top executive summary panel ("What Should the Manager Do?") with actionable directives (target gap analysis, prospecting mandates, dormant customer warnings).
    - **Top 5 Dealer Revenue Concentration Risk:** Automated portfolio risk analysis highlighting percentage of sales driven by top accounts (>80% triggers alert).
    - **KPI Cards:** Completed visits, customers covered, expected orders value, actual Tally sales, FY target achievement %, and open follow-ups.
    - **7 Scoped Tabs:** *Performance* (Target vs Actual gap & daily activity), *Customer Visits* (detailed visit log with outcomes and notes), *Pipeline* (open expected orders with overdue alerts), *Actual Sales* (Tally invoice drill-down), *Products* (product volume & revenue ranking), *Follow-ups* (due dates & priority levels), and *AI Insight* (automated sales summary).
    - **Period Controls:** Seamless switching between *Today*, *This Week*, *This Month*, and *FYTD*.
  - **Quotations & Margin Approvals:** Multi-level approval matrix for discounts and sub-margin pricing.
  - **Reports & EOD WhatsApp Summary:** Filterable management reports with one-click **PDF Print** (A4 optimized via `print.css`), **Excel/CSV Export**, and direct **WhatsApp sharing**.
  - **Tally Live Connector:** Pairing codes, rotating HMAC tokens, heartbeat monitoring, chunked session imports, and persistent high-contrast Disconnect action button.
  - **Audit Logging & Security:** Detailed tracking of logins, password resets, user creations, and export actions.

### 2. Regional Manager Portal (`/rm`)
- **Manager-Scoped Dashboard:** Automatic scoping to team members and regional customers.
- **Team Accountability & Targets:** Real-time visibility into executive visits, achievement vs monthly targets, and overdue alerts.
- **Product Growth Trends:** Multi-year product comparison (FY 2024-25 vs FY 2025-26) to detect lost or growing chemical accounts.

### 3. Field Sales PWA Workspace (`/field` / `/sales/my-day`)
- **Day Planner & GPS Attendance:** One-tap GPS check-in and check-out with time and route tracking.
- **Metric Cards & Order Tracking:** Live tracking of daily visits, completion status, **Order Expected** value (in Lakhs), and target achievement.
- **Dual-Mode Follow-ups System (Visit & Call):** Action list follow-ups supporting channel selection (**🚗 Field Visit** vs **📞 Phone Call**), priority tagging (`High`, `Medium`, `Low`) with color-coded badges, and editable priority dropdowns. Interactive **Discussion Description Boxes** feature premium border styling (`1.5px solid #0284c7`), focus halo ring, and left-accented notes display (`.followup-notes-display`) for RMs and field sales representatives.
- **Customer Visits & Voice Notes:** Quick visit logging with operational tags (`Quotation Needed`, `Sample Request`, `Technical Support`), date/time selection with UI improvements, priority level tracking (`High`, `Medium`, `Low`), clearly delineated field input borders (`1px solid var(--line)`) on Unplanned Visit dialogs, and built-in **audio voice note recording** via browser `MediaRecorder` API.
- **Lead Management Kanban (`/sales/leads`):** Visual pipeline stages from initial contact to technical demo, sample trial, quotation, and deal closed. Supports customizable referral sources including **Other** with custom name write-in.
- **Service & Support Requests:** Track customer complaints, technical trials, and commercial quotation requests.

### 4. AI Executive Intelligence & Copilot
- **Global Header AI Ask Copilot:** Accessible on every page header (`topbar`) with a glowing search bar, shortcut `[Ctrl + K]`, and a prominent gradient **Search AI** button.
- **Executive Card Formatting (`AiResponseFormatter`):** Converts raw LLM output into structured **Executive Action Cards** with blue **Data Point** badges, green **Recommended Action** boxes, and inline currency/count metric pills (`askai-metric-pill`).
- **Instant Query Execution:** Clicking suggested prompt chips immediately fills the input and triggers live database intelligence retrieval.
- **One-Click Copy & Data Provenance:** Integrated **Copy** button with instant state feedback and live SQL data provenance details.
- **Grounded SQL Data Engine:** Context synthesized directly from real-time database tables (`tally_invoices`, `tally_products`, `tally_customers`, `leads`, `follow_ups`, `salesperson_profiles`).
- **Resilient AI Model Engine:** Connected via **Google Gemini API** (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-3.6-flash`) via `GEMINI_API_KEY` (with fallback to OpenAI `gpt-4o-mini`).
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
