# PSSPL CRM System Architecture & Technical Specifications

This document outlines the complete technical architecture of the PSSPL CRM, spanning frontend client applications, Express API services, SQLite database schema, accounting synchronisation, and external automations.

---

## 1. High-Level Architecture & Production Topology

```mermaid
graph TD
    ClientBrowser[Desktop & Mobile Browser / PWA] -->|HTTPS / Edge CDN| VercelFrontend[Vercel Serverless: psspl-crm.vercel.app]
    VercelFrontend -->|Reverse Proxy / Direct API| RenderBackend[Render Node.js 22: psspl-crm-backend.onrender.com]
    RenderBackend -->|Native WAL| DB[(SQLite: data/crm.sqlite + Auto-restore gzip)]
    
    subgraph Data Flow & Integrations
        RenderBackend -->|Context Injection| Gemini[Google Gemini API gemini-2.5-flash / gemini-2.0-flash]
        RenderBackend -->|Meta Graph API| WhatsApp[WhatsApp Cloud API]
        RenderBackend -->|Cron 17:00 IST| EODService[EOD Daily Summary Cron]
        TallyAgent[Tally Windows Agent] -->|Chunked HMAC Sync| RenderBackend
        RenderBackend -->|supabase-sync.mjs (UPSERT)| Supabase[(Supabase Postgres Cloud Replica)]
        GitHubRepo[GitHub: DeepakSingh-gh/psspl] -->|CI/CD Git Triggers| VercelFrontend
    end
```

### Production Deployment Topology
* **Frontend Web Application:** Hosted on **Vercel** (`https://psspl-crm.vercel.app`), configured with Next.js 15 App Router, static page optimization across 27 routes, and `.env.production` pointing to the live Render API.
* **Backend API Server:** Hosted on **Render** (`https://psspl-crm-backend.onrender.com`), running Node.js 22 with Express 5.1, SQLite WAL mode, and automated decompression of `data/crm-baseline.sqlite.gz` (57 MB uncompressed) on startup if the database file is absent.
* **Source Control:** Synchronized on GitHub at [https://github.com/DeepakSingh-gh/psspl](https://github.com/DeepakSingh-gh/psspl).

---

## 2. Technology Stack

* **Frontend Framework:** Next.js 15.5 (React 19, TypeScript 5.9) with App Router.
* **Corporate Brand Identity:** Vector `<PssplLogo />` component (`src/components/common/psspl-logo.tsx`) with transparent background blending, precision hexagonal flask symbol, and crisp PSSPL typography integrated across Admin, RM, Sales sidebars, report headers, and authentication portals.
* **Styling & Presentation:** Progressive Surface Systems (PSS) Vanilla CSS Design Tokens (`--honolulu-blue: #007CBA`, `--voluptuous-violet: #7A00DF`, `--love-goddess: #CC1818`, `--exhilarating-green: #7CC68D`, `--steam: #DDDDDD`, `--black: #000000`), custom follow-up description box styles (`.followup-textarea` with `1.5px solid #007CBA` border & focus ring + `.followup-notes-display` left accent container), media query print stylesheet (`print.css`), and global header AI bar (`.topbar-ai-search`).
* **Ask AI Command Center & Formatting:** React `createPortal` (`document.body`) for modal overlay, quick date presets (*FY 2026-27*, *Last 30 Days*, *All Data*), clear button (`✕`), categorized prompt chips with icons, and `AiResponseFormatter` for parsing LLM Markdown into structured **Executive Insight Cards** with data point badges, action boxes, and metric pills.
* **Mobile-First & Laptop-Safe Responsive Layout:**
  - Sliding off-canvas navigation drawer with backdrop tap-to-dismiss (`.admin-sidebar-backdrop`) and animated vector hamburger button.
  - Responsive multi-breakpoint design (`< 1280px`, `< 1000px`, `< 768px`, `< 480px`).
  - Fluid grid system (`.rm-kpi-grid`, `.rm-3col-grid`, `.rm-2col-grid`, `.rm-thrust-grid`, `.rm-stat-3col`) with `min-width: 0` constraints to eliminate table blowout on 360px-480px viewports.
  - **Zero Horizontal Side-Scroll Architecture:** Root HTML, body, and `.admin-shell` hardened with `width: 100%; max-width: 100%; overflow-x: clip;` (replacing `100vw` / `overflow-x: hidden`, which caused horizontal panning on Windows/Blink laptops due to the 17px vertical scrollbar).
  - **Sidebar Pinned Geometry:** Pinned desktop sidebar to `width: 264px; min-width: 264px; max-width: 264px; flex-shrink: 0; left: 0;` ensuring navigation stays fixed and never squishes or shifts off-screen.
  - **Responsive Command Tracks:** Collapses `.command-story` and `.command-money-field` into single columns at `< 1280px` using `minmax(0, 1fr)` tracks, and clips `.command-chart svg` with `overflow: hidden`.
* **Integrated Search Controls & Voice STT:** `<VoiceMicButton>` component integrated on all search inputs with dual-engine Speech-to-Text (browser Web Speech API for free instant transcription + backend OpenAI Whisper API `POST /api/stt` endpoint in `server/stt.mjs`).
* **Backend Runtime:** Node.js native ES Modules (`server/app.mjs`), Express 5.1 with SQLite WAL mode.
* **Authentication Security:** Asynchronous non-blocking `crypto.scrypt` password verification (`promisify`), malformed hash guards, strict `Bearer` token validation, and background session cleanup.
* **AI Engine:** Google Gemini API (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-3.8-flash`) via `GEMINI_API_KEY` with live SQL context window synthesis (`server/ai-context.mjs`) and zero-thinking budget (`thinkingBudget: 0`) optimization for sub-4-second conversational analytics.
* **Scheduler & Automation:** `node-cron` running daily at 5:00 PM IST (EOD WhatsApp digest).
* **Media & Voice Recording:** HTML5 `MediaRecorder` API + Web Speech API + `multer` backend audio storage and OpenAI Whisper `whisper-1` transcription.

---

## 3. Database Schema Overview

All application state resides in `data/crm.sqlite` across four primary domains:

### A. Authentication & User Management
* `users`: `id`, `email`, `password_hash` (`scrypt`), `role` (`admin` | `rm` | `salesperson`), `active`, `created_at`.
* `salesperson_profiles`: `user_id`, `employee_code`, `full_name`, `region`, `territory`, `operating_city`, `reg_code_1`, `reg_code_2`, `manager_user_id`, `monthly_target`.
* `sessions`: Sliding window session tokens with idle timeout and maximum lifetime ceiling.
* `audit_logs`: Entity-level audit logging of admin actions, resets, and report exports.

### B. Field Mobility & Commercial Pipeline
* `attendance`: Daily GPS check-in and check-out with coordinates and timestamps.
* `visits`: Scheduled, in-progress, and completed dealer visits with purpose, outcomes, notes, `visit_tags`, `voice_note_path`, and `priority` (`high`, `medium`, `low`).
* `leads`: Kanban pipeline stages (`lead`, `technical_discussion`, `sample`, `quotation`, `follow_up`, `expected_order`, `won`, `lost`).
* `service_requests`: Customer complaints, technical trial evaluations, and quotation support tickets.
* `expected_orders`: Order pipeline tracking with expected amounts, dates, and statuses.
* `follow_ups`: Scheduled action items with due dates, priority levels (`high`, `medium`, `low`), channel mode (`follow_up_type`: `'call'` | `'visit'`), discussion notes (`notes`), and assignment (`assigned_to_user_id`).

### C. Tally Accounting Snapshots & Live ERP Tables
* `tally_customers`: Master list of 171 dealers/customers with city, RM assignment, outstanding ledger balance, `owner_user_id`, and last payment date.
* `tally_customer_monthly_sales`: 14-month historical monthly billing matrix.
* `tally_products`: Master catalog of 666 products with packing sizes, UOM, and unit prices.
* `tally_product_monthly_sales`: Monthly product movement quantities and sales values.
* `tally_rm_product_sales`: 1,896 product performance comparisons across all 12 Regional Managers.
* `tally_rm_targets`: Monthly sales targets in Lakhs for all RMs.
* `tally_invoices` & `tally_invoice_lines`: 868 real invoices and 1,730 product line items representing Rs 35.47 Cr in billing.
* `tally_payments_live`: Real-time collection payment receipts (`id`, `company_name`, `voucher_guid`, `voucher_number`, `payment_date`, `payment_type`, `customer_id`, `customer_name`, `amount`, `reference`, `source_sync_id`).
* `tally_purchases` & `tally_purchase_lines`: Ingested supplier purchases and chemical raw material procurement lines (`supplier_name`, `quantity`, `rate`, `amount`, `uom`).
* `tally_import_metadata`: Ingest sync state and transaction boundaries (`key`, `value`).
* `rm_weekly_purchases`: 4-week monthly breakdown matrix of actual purchases vs weekly quotas.
* `rm_historical_monthly_performance`: Multi-year monthly target vs actual ledger storing previous financial year comparisons.

### D. Strategic & Thrust Products Tracking
* `thrust_products`: High-margin, strategically vital chemical products established at the start of the financial year (`id`, `product_name`, `alias_keywords`, `sort_order`, `active`, `created_at`). Pre-seeded with priority lines: *Zpn Blue 15, Zpn 200, Zpn Black, Shimaclad Peony, Clearclad Lcbh, Enilex Chrome Catalyst, POP, Uviclad 612, Patinas*.
* `dormant_reasons`: Structured customer dormancy explanations and recovery action logs submitted by RMs.

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
* `/admin/team`: Executive Team Performance Dashboard with traffic-light achievement pill badges, RM sorting, dedicated **Strategic Thrust Products — RM Leaderboard**, and **Sticky Table Column Headers on Scroll** (headers remain pinned at `top: 0` with `z-index: 10` inside a scrollable container). Features corrected target scaling (Lakhs-to-Rupees) with exact achievement percentages.
* `/admin/team/[id]`: Comprehensive Executive RM Report Card (8-tab breakdown: *Performance*, *Customer Visits*, *Pipeline*, *Actual Sales*, *Products*, *Follow-ups*, *Manager Action Plan*, and *AI Insight*). Features canonical RM ID resolution (`aniljenafield` ↔ `aniljena`), active ledger cycle synchronization (anchors to latest active reporting month like September 2026 to ensure zero metric discrepancies across badges, milestones, and graphs), period-aware target proration, RM Code (`075709`), Operating headquarters (`Gurugram`), Team Executive Cities tags, clock-in/out timestamps, Special Achievements & Milestones (Vacant Box Architecture, 4 slots), Monthly Sales Target vs Actual Bar Chart, Thrust Product Sales Breakdown, and dedicated **Download Report** header action button.
* `/admin/team/[id]/print`: High-definition, A4 printable Executive RM Report Card view featuring full header identity, 8-KPI executive performance cards, Target vs Actual bar breakdown, side-by-side Top Customers and Top Products tables, recent visit transcripts, open follow-up actions, and a fixed top controls bar (`Download PDF` triggering `window.print()` and `Close`).
* `/rm/*`: Regional Manager portal with clean, focused home dashboard, team accountability, regional customer 360, product comparisons, overdue alerts, live clock-in / clock-out attendance tracking, and streamlined top banner (redundant region tabs removed for optimal aesthetic clarity).
* `/rm/print-report`: High-definition 1:1 reproduction of the official **PSSPL Regional Manager Sales Target Feedback Support Report** with A4 print and PDF download capabilities.
* `/sales/*` & `/sales/my-day`: Salesperson Day-Planner with RM Executive identity header pills (RM Code, Operating from, Region, Coverage cities), live rupee formatted monthly quota metrics (`Actual from Tally`, `Target`, `Gap` / `Surplus` in Lakhs/Rupees), active ledger period badges (`2026-09 active ledger`), `✓ Target Achieved` milestone pill, GPS check-in/out tracking, visit execution, voice note recording, Kanban pipeline with instant lead deletion, and modern `AnimatedSelect` dropdowns with smooth cubic-bezier transitions for customer visit scheduling.

### API Services
* `GET /api/admin/team`: Aggregates team performance, sales values, period-accurate targets from `tally_rm_targets` and profiles (scaled with `LAKH`), unassigned sales, individual RM thrust metrics (`thrustSalesValue`, `thrustSalesLakh`, `thrustActiveCount`, `thrustTopProduct`), and cross-team `thrustLeaderboard` ranking across all Regional Managers for the selected Financial Year.
* `GET /api/admin/team/:id`: Fetches detailed RM sales activity metrics, visits log (strictly date-filtered by requested `startDate` and `endDate`), expected order pipeline, actual Tally invoices, product movement ranking, open follow-ups, `rmCode`, `operatingFrom`, `dealerCities`, `specialAchievements`, 12-month `monthlyTargetVsActual` chart series, and RM-specific `thrustProducts` analytics. Scoped to capture visits, pipeline, and follow-ups across all linked RM accounts (`sp-101`, `rm-anil-jena`), subordinate sales reps, and regional dealer accounts.
* `POST /api/sales/visits/unplanned`: Creates an unplanned customer visit with multi-tier access authorization (`canAccessCustomer`), enabling RMs and field sales representatives to plan visits across all customers in their territory, assigned portfolios, and managed team members.
* `GET /api/rm/print-report`: Powers the printable PDF report with basic details, executive team mapping, annual summary, 12-month metrics, 4-week matrix, previous year benchmarks, territory expansion, and thrust line actuals.
* `DELETE /api/sales/leads/:id`: Removes a lead from the salesperson pipeline along with associated activities and service requests.
* `POST /api/stt`: Receives recorded speech audio blobs (`multipart/form-data`) and transcribes speech to text using OpenAI Whisper API (`whisper-1`).

---

## 5. Automation & Integration Pipelines

### 1. Daily 5:00 PM EOD Summary Cron
Located in `server/app.mjs`:
* Triggers every day at 17:00 (`0 17 * * *`).
* Queries day attendance, completed visits, expected order bookings, and pending collections.
* Formats a clean WhatsApp markdown message and dispatches it via `server/whatsapp.mjs`.

### 2. Live Database AI Context & Response Formatting (`server/ai-context.mjs` & `AiResponseFormatter`)
* Dynamically synthesizes live database tables (`tally_invoices`, `tally_products`, `tally_customers`, `leads`, `follow_ups`, `salesperson_profiles`).
* Formats response via `AiResponseFormatter` into visual executive cards, metric pill badges, and data point callouts.
* Features integrated gradient search button and instant chip execution.
* Automatic model failover across `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`, and `gemini-3.6-flash`.

### 3. Supabase Cloud Sync Engine (GI Connector)
Located in `server/supabase-sync.mjs` and `server/connector-api.mjs`:
* Asynchronously spawned by the Express server immediately after a Tally GI chunk upload is finalized (`action === "finalize"`).
* Leverages advanced Postgres `INSERT INTO ... ON CONFLICT (...) DO UPDATE` commands.
* Syncs local `crm.sqlite` schema and data to Supabase Postgres (acting as a Cloud Replica) without overlap or duplication, enabling external cloud analytics.

### 4. Modern Sales & Analytics Dashboards
* Features a premium glassmorphic Kanban pipeline and Optimistic UI Drag-and-Drop.
* **Quarter-wise Trend Analysis:** Automated aggregation and progress-bar tracking of Q1-Q4 revenue directly on the admin overview.
* **Dormant Dealer Reporting:** AI-driven flagging of accounts with no purchase activity in >3 months (90 days), with built-in RM feedback forms mapped to the `dormant_reasons` schema.

### 5. Strategic Thrust Products & RM Report Card Engine
Located in `server/admin.mjs` and `src/components/admin/`:
* **Thrust Product Aggregation & Intelligence:** Annual strategic chemical focus items defined in `thrust_products` are evaluated across all billed line items (`tally_invoice_lines` joined with `tally_invoices`). Flexible case-insensitive matching attributes volume, rupee value, Lakhs, and dealer reach per Regional Manager.
* **Admin Thrust Leaderboard:** Computes cross-team rankings (`thrustLeaderboard`) comparing every RM's thrust product contribution, active thrust lines sold, and top volume product, displayed directly on `/admin/team`.
* **Monthly Target vs Actual Graph Engine:** Synthesizes 12-month financial year performance (Apr-Mar) by pairing `tally_rm_targets` with monthly invoice totals (`tally_invoices`). Renders interactive comparative dual-bar charts (`TargetVsActualMonthlyChart`) with surplus/shortfall badges.
* **Dedicated Manager Action Plan Tab:** Extracted from AI insights into its own dedicated executive tab (`📋 Manager Action Plan`), consolidating immediate directives, territory gap assessments, concentration risks, and scrollable recent visit transcripts.
* **RM Executive Identification & Accolades:** Dynamically derives RM code identifier (`rmCode`), regional operating cities (`operatingCities`), and achievement milestone container (`Special Achievements & Milestones`) in the report card header.
* **Friendly Executive UI Architecture:** Replaced complex/stacked tags with a streamlined executive card hierarchy: clean identity row (Avatar, RM code, Region, Operating city, real-time clock-in/out pill, performance status chip), compact horizontal territory coverage pill group, unified follow-up scheduler, and resilient check-in location fallback.
* **Download Report & In-Page Preview Engine (`src/components/admin/rm-report-pdf.tsx`):**
  - **In-Page Report Preview Modal (`RmReportPreviewModal`):** Prominent green action button in the report card header (`⬇ Download Report`) opens an interactive modal directly over the current dashboard screen without navigating away or opening new browser tabs.
  - **Strict 2-Page Executive A4 Document Architecture (`RmReportDocument`):**
    - **Page 1 (Sales & Target Performance Overview):** Executive identity cover card with achievement % badge (`135%`, `On Track ✅`), 8 KPI metrics (Target, Actual, Gap/Surplus, Achievement %, Active Customers, Visits, Follow-ups, Products), **High-Resolution Vector SVG Dual-Bar Graph** (visualizing the 12-month Target vs Actual sales trajectory with achievement % flags and reference gridlines at 0ms render latency), and side-by-side Top Customers and Top Products ranking tables.
    - **Page 2 (AI Intelligence & Managerial Action Directives):** Branded section header, **AI Executive Diagnostic & Field Intelligence** (automated operational narrative), **Manager Action Plan** (priority items with urgency tags and direct supervisory action steps), and recent customer visits & open follow-ups.
  - **Direct Page-by-Page Multi-page PDF Downloader (`downloadRmReportDirect`):** Uses `html2canvas` to render Page 1 (`#rm-report-page-1`) and Page 2 (`#rm-report-page-2`) independently into high-resolution retina canvases, then writes each directly to `jsPDF` pages (`210mm × 297mm`). Eliminates auto-slicing artifacts, avoids blank overflow pages, excludes Ask AI / browser chrome, and guarantees an exact 2-page PDF file downloaded straight to the browser.

### 6. High-Performance Data & Caching Architecture
* **Composite SQLite Indexes:**
  - `idx_tally_customers_rm_name`: Accelerates RM customer lookups and outstanding joins.
  - `idx_tally_invoices_session_date`: Optimizes date-range invoice filtering while ignoring raw ingestion sessions.
  - `idx_tally_invoice_lines_inv_prod`: Eliminates full scans on product-line item lookups across 27,000+ line items.
  - `idx_tally_rm_product_sales_rm`: Speeds up previous-year RM performance comparisons.
  - `idx_tally_payments_date_customer`: Accelerates payment receipt reconciliation by date and customer ID.
  - `idx_tally_purchases_date_supplier`: Indexes supplier procurement vouchers by purchase date and supplier name.
  - `idx_tally_purchase_lines_product`: Optimizes raw material volume aggregation across purchase line items.
  - `idx_tally_customers_owner_user_id`: Enforces instant owner-based customer scoping for sales reps.
* **Single-Pass In-Memory Thrust Aggregation (`calculateAllThrustProductsBatch`):**
  - Replaced 330+ repetitive nested SQL queries with an in-memory aggregation map, cutting `/api/admin/team` latency from 3,630ms to ~450ms (8× speedup).
* **Client-Side SWR (Stale-While-Revalidate) Cache Layer (`src/lib/use-admin-data.ts`):**
  - Client hook provides instant zero-latency rendering of cached records with background API revalidation.
  - Namespaced composite cache keys (`${loaderSource}::${JSON.stringify(deps)}`) prevent cross-endpoint data pollution.
  - Defensive null-safe accessors in `AdminOverview` ensure resilient runtime behavior during state transitions.
* **Webpack Runtime & Build Cache Isolation:**
  - When transitioning between production verification (`npm run build`) and active development (`npm run dev`), `.next` build caches are automatically isolated/purged to prevent in-memory chunk map collisions (such as `Cannot find module './308.js'`).


