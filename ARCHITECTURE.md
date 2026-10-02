# PSSPL CRM System Architecture & Technical Specifications

This document outlines the complete technical architecture of the PSSPL CRM, spanning frontend client applications, Express API services, SQLite database schema, accounting synchronisation, and external automations.

---

## 1. High-Level Architecture

```mermaid
graph TD
    ClientBrowser[Desktop & Mobile Browser / PWA] -->|Next.js App Router :3000| Frontend[Next.js 15 UI Layer]
    Frontend -->|REST API :4000| Backend[Express.js 5 API Server]
    Backend -->|Native WAL| DB[(SQLite: data/crm.sqlite)]
    
    subgraph Data Flow & Integrations
        Backend -->|Prompt Context Injection| OpenAI[OpenAI gpt-4o-mini]
        Backend -->|Meta Graph API| WhatsApp[WhatsApp Cloud API]
        Backend -->|Cron 17:00 IST| EODService[EOD Daily Summary Cron]
        TallyAgent[Tally Windows Agent] -->|Chunked HMAC Sync| Backend
        ExcelWorkbooks[PSSPL Client Excel Workbooks] -->|import_psspldata.py| DB
    end
```

---

## 2. Technology Stack

* **Frontend Framework:** Next.js 15.5 (React 19, TypeScript 5.9) with App Router.
* **Styling & Presentation:** Vanilla CSS Design Tokens, responsive glassmorphism aesthetic, media query print stylesheet (`print.css`).
* **Backend Runtime:** Node.js native ES Modules (`server/app.mjs`), Express 5.1.
* **Database Engine:** Node 22+ built-in `node:sqlite` (synchronous execution, WAL journal mode, memory temp store).
* **AI Engine:** OpenAI `gpt-4o-mini` with dynamic context window synthesis (`ai-context.mjs`).
* **Scheduler & Automation:** `node-cron` running daily at 5:00 PM IST (EOD WhatsApp digest).
* **Media & Voice Recording:** HTML5 `MediaRecorder` API + `multer` backend audio storage.

---

## 3. Database Schema Overview

All application state resides in `data/crm.sqlite` across three primary domains:

### A. Authentication & User Management
* `users`: `id`, `email`, `password_hash` (`scrypt`), `role` (`admin` | `rm` | `salesperson`), `active`, `created_at`.
* `salesperson_profiles`: `user_id`, `employee_code`, `full_name`, `region`, `territory`, `manager_user_id`, `monthly_target`.
* `sessions`: Sliding window session tokens with idle timeout and maximum lifetime ceiling.
* `audit_logs`: Entity-level audit logging of admin actions, resets, and report exports.

### B. Field Mobility & Commercial Pipeline
* `attendance`: Daily GPS check-in and check-out with coordinates and timestamps.
* `visits`: Scheduled, in-progress, and completed dealer visits with purpose, outcomes, notes, `visit_tags`, and `voice_note_path`.
* `leads`: Kanban pipeline stages (`lead`, `technical_discussion`, `sample`, `quotation`, `follow_up`, `expected_order`, `won`, `lost`).
* `service_requests`: Customer complaints, technical trial evaluations, and quotation support tickets.
* `expected_orders`: Order pipeline tracking with expected amounts, dates, and statuses.
* `follow_ups`: Scheduled action items with due dates, priority levels (`today`, `high`, `normal`), and assignment.

### C. Tally Accounting Snapshots
* `tally_customers`: Master list of 171 dealers/customers with city, RM assignment, outstanding ledger balance, and last payment date.
* `tally_customer_monthly_sales`: 14-month historical monthly billing matrix.
* `tally_products`: Master catalog of 666 products with packing sizes, UOM, and unit prices.
* `tally_product_monthly_sales`: Monthly product movement quantities and sales values.
* `tally_rm_product_sales`: 1,896 product performance comparisons across all 12 Regional Managers.
* `tally_rm_targets`: Monthly sales targets in Lakhs for all RMs.
* `tally_invoices` & `tally_invoice_lines`: 868 real invoices and 1,730 product line items representing Rs 35.47 Cr in billing.

---

## 4. Portals & Security Model

```
+-----------------------------------------------------------------+
|                       PSSPL CRM Security                        |
+-----------------------------------------------------------------+
| Admin Role:       Full system visibility, user administration,  |
|                   approvals, connectors, and report exports.    |
|                                                                 |
| RM Role:          Scoped to team members and regional dealers   |
|                   matching `manager_user_id` or `rm_name`.      |
|                                                                 |
| Salesperson Role: Scoped to self-assigned visits, leads, day    |
|                   planner, and customer master catalog.         |
+-----------------------------------------------------------------+
```

### Route Structure
* `/admin/*`: Admin dashboard, quotation approvals, user directory, management reports, Tally sync.
* `/rm/*`: RM home, team accountability, regional customer 360, product comparisons, overdue alerts.
* `/sales/*` & `/field`: Salesperson Day-Planner, GPS check-in, visit execution, voice note recording, Kanban pipeline.

---

## 5. Automation & Integration Pipelines

### 1. Daily 5:00 PM EOD Summary Cron
Located in `server/app.mjs`:
* Triggers every day at 17:00 (`0 17 * * *`).
* Queries day attendance, completed visits, expected order bookings, and pending collections.
* Formats a clean WhatsApp markdown message and dispatches it via `server/whatsapp.mjs`.

### 2. OpenAI Context Synthesis (`server/ai-context.mjs`)
* Dynamically extracts recent user visits, team sales, target variance, and top active customers.
* Compresses data into `<2000` tokens and passes it into system prompt for real-time grounded intelligence.

### 3. Excel Workbook Importer (`scripts/import_psspldata.py`)
* Automatically parses workbooks from `C:\Users\deepa\Downloads\psspldata`:
  - `6) Dealer Summary Apr, 2023 to May, 2024.xlsx`
  - `8) PSS Product Analysis I 2022-23 (005).xlsx`
  - `10) COMPARISON OF PRODUCT WITH QTY.xlsx`
  - `9) PSS Sales Incentive Calculations-24-25.xlsx`
  - `2) All Party wise Payments.xlsx`
* Generates synchronized user accounts, product lines, and real invoices for immediate operational testing.
