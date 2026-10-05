# PSSPL CRM — Enterprise Sales & Accounting Intelligence Platform

An enterprise CRM and field sales platform specifically designed for **Progressive Surface Systems Pvt. Ltd. (PSSPL)**, integrating Tally accounting data with field sales mobility, Regional Manager oversight, and executive analytics.

---

## 🚀 Quick Start

### 1. Installation & Running
```bash
# Install dependencies
npm install

# Start development servers (Next.js on 3000 + Express API on 4000)
npm run dev
```

### 2. Live Application Portals
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

The CRM is loaded with actual client records imported from `C:\Users\deepa\Downloads\psspldata`:

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
py -3.11 scripts/import_psspldata.py "C:\Users\deepa\Downloads\psspldata"
```

---

## 🛠️ Implemented Architecture & Features

### 1. Executive Admin Dashboard (`/admin`)
- **Revenue & Territory Intelligence:** Total sales, collection status, territory breakdown, top-performing chemical products.
- **Team Performance & Accountability:** Sortable team performance tables prioritizing target achievement ("Poor to Good" and "Good to Poor").
- **RM Sales Activity & Performance Drill-down (`/admin/team/[id]`):** Clicking any RM or salesperson name opens a comprehensive 7-tab sales activity dashboard featuring:
  - **KPI Cards:** Completed visits, customers covered, expected orders value, actual Tally sales, FY target achievement %, and open follow-ups.
  - **7 Scoped Tabs:** *Performance* (Target vs Actual gap & daily activity), *Customer Visits* (detailed visit log with outcomes and notes), *Pipeline* (open expected orders with overdue alerts), *Actual Sales* (Tally invoice drill-down), *Products* (product volume & revenue ranking), *Follow-ups* (due dates & priority levels), and *AI Insight* (automated sales summary).
  - **Period Controls:** Seamless switching between *Today*, *This Week*, *This Month*, and *FYTD*.
- **Quotations & Margin Approvals:** Multi-level approval matrix for discounts and sub-margin pricing.
- **Reports & EOD WhatsApp Summary:** Filterable management reports with one-click **PDF Print** (A4 optimized via `print.css`), **Excel/CSV Export**, and direct **WhatsApp sharing**.
- **Tally Live Connector:** Pairing codes, rotating HMAC tokens, heartbeat monitoring, and chunked session imports.
- **Audit Logging & Security:** Detailed tracking of logins, password resets, user creations, and export actions.

### 2. Regional Manager Portal (`/rm`)
- **Manager-Scoped Dashboard:** Automatic scoping to team members and regional customers.
- **Team Accountability & Targets:** Real-time visibility into executive visits, achievement vs monthly targets, and overdue alerts.
- **Product Growth Trends:** Multi-year product comparison (FY 2024-25 vs FY 2025-26) to detect lost or growing chemical accounts.

### 3. Field Sales PWA Workspace (`/field` / `/sales/my-day`)
- **Day Planner & GPS Attendance:** One-tap GPS check-in and check-out with time and coordinates.
- **Customer Visits & Voice Notes:** Quick visit logging with operational tags (`Quotation Needed`, `Sample Request`, `Routine Check`) and built-in **audio voice note recording** via browser `MediaRecorder` API.
- **Lead Management Kanban (`/sales/leads`):** Visual pipeline stages from initial contact to technical demo, sample trial, quotation, and deal closed.
- **Service & Support Requests:** Track customer complaints, technical trials, and commercial quotation requests.

### 4. AI & Automation Services
- **Ask AI Assistant:** Context-aware AI queries backed by OpenAI `gpt-4o-mini`, with automatic synthesis of customer outstanding balances, top products, and recent visits (graceful fallback if API key is not configured).
- **Automated 5:00 PM EOD Cron:** Built with `node-cron` in `server/app.mjs`, compiling daily visits, order booking, and attendance into a WhatsApp digest sent via Meta WhatsApp Cloud API.

---

## ⚙️ Environment Variables (Optional)

Create a `.env` file in the root directory to customize API keys:

```ini
# Server Configuration
PORT=4000
CRM_ADMIN_EMAIL=admin@psspl.com
CRM_ADMIN_PASSWORD=psspl-admin-2026

# OpenAI Integration (Ask AI)
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
