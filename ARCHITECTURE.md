# PSSPL CRM System Architecture & Technical Specifications

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

<!-- oct27-ui-details:start -->
## Read-only RM top-sales projection

`server/rm-performance-report.mjs` adds optional `topSales` via `server/rm-top-sales.mjs`. Customer aggregates reuse the existing voucher query; product aggregates use signed authoritative lines grouped by master ID (exact recorded name when missing). Existing RM/subordinate scope, period/cutoff and net-sales rules are preserved. Both shares use total report RM sales; zero/negative denominators and aggregate-only snapshots remain unavailable. No schema, persistence, inferred parent grouping or demo source is added. `RmTopSales` is reused by Performance Details and one measured PDF pagination block; line/header variance is disclosed.


Latest follow-up: [Local preview and RM dashboard scope](docs/operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup): **Start Preview / Exit Preview** controls optional Rais Khan sample rows. Empty products receive five examples; a short customer list keeps real rows and appends marked samples to five. Sample customer shares are unavailable and totals remain recorded values. Dashboard/PDF labels match; no persistence occurs. The bottom Monthly target card is hidden for RM accounts only, with the salesperson card retained.
<!-- oct27-ui-details:end -->

## Admin chart and navigation presentation — 26 October 2026

`SalesTrend` uses the existing Tally-backed Product Trends response and chart helpers. Its light theme is scoped to `sales-performance-trend.module.css`; the component delegates grid/crosshair strokes to CSS. Theme changes preserve the 290px chart height, all calculations, response handling and interactions. `AdminShell` removes only the Reporting navigation group, retaining route implementations and authorization. No schema, source-data, dependency or other workspace change is involved. See [Admin UI operation and verification](docs/operations/admin-product-trends-and-sidebar.md).

## Product Trends source and alternative comparisons — 26 October 2026

`server/product-trend-data.mjs` enriches only the existing Admin Product Trends response. Authoritative item lines take priority; historical product/RM snapshots can fill an otherwise empty matching complete FY without being added to overlapping invoice totals. Rates, dated monthly quantities, month counts and RM details retain provenance. Packing variants retain their names/IDs; family association is metadata, not a totals rollup.

`server/product-trend-comparison.mjs` adds an independent `recentComparison` object while preserving original FY/YoY fields. It selects consecutive recorded months bounded by the available history, classifies movement only for paired exact variants, computes FY contribution and observation-window lifecycle, and reports item-line versus voucher-header reconciliation. The frontend uses explicit MoM labels only when YoY is unavailable, preserving the five cards, existing grids and chart controls. Genuine prior-year vouchers are still required for monthly YoY; generated equal-month `excel-import` records are excluded. See [source investigation, formulas, figures and limits](docs/operations/admin-product-trends-and-sidebar.md#product-trend-data-and-comparison-recovery).

## Current local RM report presentation - 24 October 2026

`src/lib/rm-client-demo.mjs` adapts a copy of the report only in an explicitly selected, authenticated Admin session on localhost. RM/FY/version hashes keep attendance/product examples stable; no demo API parameters or database writes are introduced. The workspace passes one prepared report to the dashboard and PDF, while verified raw evidence continues to drive insights/actions. The UI and PDF place the existing Manager Action Plan before KPIs and retain AI Insights after saved entries. PDF reuses the calendar and four-column product renderers, exports every saved entry in eight columns and measures blocks with the final A4 page styles. `src/components/reports/rm-pdf-pagination.ts` keeps cards/rows intact and reserves continuation-heading/footer space. Preview and download consume the same paginated representation; the former supporting-detail appendix is removed. Shared chart legends contain smaller `(<100%)` / `(≥100%)` second lines. See [implementation, exact files and QA evidence](docs/operations/rm-report-finalization.md).

## Current local account/email architecture - 21 October 2026

- Current AI generation selects Claude through backend-only environment credentials. Shared Ask AI retains authorized evidence selection. The active V2 RM workspace uses `enrichPerformanceReview` to prioritize server-verified finding IDs; insight/action prose remains in vetted templates. Its payload contains scoped facts and period dates, but no explicit RM name/ID. The legacy admin analysis endpoint separately generates validated recommendations. Both flows retain honest failure handling and server-owned metrics. [Current verification and limits](docs/operations/rm-report-finalization.md#ai-verification-and-limits). Uploaded Whisper transcription remains disabled in Claude mode.
- Supplied RM feedback uses checked-in `server/data/rm-feedback-snapshots.json`, loaded once and indexed by `server/rm-feedback.mjs`. Admin can browse all 12 historical snapshots; the RM print endpoint resolves only the authenticated identity. No request-time PDF parsing or AI call is required. This is separate from live sales aggregates; see [snapshot architecture and import notes](docs/operations/rm-feedback-snapshots.md).
- Admin-controlled **Create user & Send Email** and **Send Account Email** send a professional full-profile template from saved user/profile/RM records. Supplied current/initial passwords are verified against salted scrypt hashes before inclusion; existing hashes are not reversible. Confirm-password is validation-only.
- `server/account-email-template.mjs` renders branded HTML and plain text. `server/email-provider.mjs` selects preserved Resend or Nodemailer SMTP. Gmail uses the authenticated sender's backend-only App Password over TLS; the current temporary sender is `deepaksingh873785@gmail.com`.
- The AES-256-GCM queue stores password-bearing templates encrypted, never in API responses or audit details. Credential-version checks cancel unsent email after password changes. Provider pinning and token-free account notices are migrations 013 and 014 respectively. Password recovery remains random, single-use, 15-minute tokens; new links use browser-only fragments.
- SMTP provider acceptance is not inbox delivery. Safe pre-submit/explicit temporary failures can retry; ambiguous submissions and expired SMTP leases are held as unknown. Resend retains stable idempotency and signed delivery webhooks. Cooldown responses show previous delivery status.
- A local-only account email can include employee details and a supplied password without a broken localhost link. Remote login/setup still requires a reachable CRM URL and matching remote database; local creation does not provision a separate deployed instance.
- **Restore employee** reuses the archived identity and CRM history with new credentials. **View check-in on map** links stored attendance coordinates to a map; it does not create missing GPS data or guarantee exact accuracy.

See [current source summary](docs/operations/2026-10-21-current-state.md) and [email operations](docs/operations/gmail-smtp-authentication.md). The deployment snapshots below retain their original dates; these local changes were not deployed by the documentation refresh.

This document outlines the complete technical architecture of the PSSPL CRM, spanning frontend client applications, Express API services, SQLite database schema, accounting synchronisation, and external automations.

### Historical deployment snapshot — 16 October 2026

Local `main` tracks `DeepakSingh-gh/psspl` through `origin`. The last verified frontend release is commit `87eae1e` on Vercel (`dpl_8Lqo3dUH9DPXpMFLT4QJGFmtTbgD`). RM landing/redirect changes and report tab prioritization are live. Backend AI-provider and query/compression changes are in source control, but Render still runs the prior backend build; deploying those changes requires preserving its live SQLite data. Render automatic deployment settings were restored after each protected frontend release. Automatic Vercel Git linking remains permission-blocked; explicit API releases succeeded. This documentation update is local only.

### Local-only automatic attendance revalidation — 16 October 2026

Admin Overview/Alerts, Team, RM detail and Field Activity opt into attendance updates through `useAdminData(..., liveAttendance=true)`. `admin-attendance-live.ts` shares one `attendance-monitor.ts` poller across mounted views. It checks every two seconds while visible, prevents overlapping requests, aborts requests after ten seconds or on final unsubscribe, and checks immediately on focus/visibility/online events. Hidden tabs skip network requests; outages retain displayed data and retry.

`GET /api/admin/attendance/revision` is behind admin authentication/authorization and sends `Cache-Control: no-store`. `server/attendance-revision.mjs` hashes the current business day's persisted user/check-in/check-out rows in stable order; alias entries, edits, deletions and date rollover change the signature. Revision changes invalidate each subscribed admin cache key and rerun its loader without remounting the page. The endpoint reads the database; it does not depend on an in-process mutation counter, Tally sync or the client that performed attendance updates. No schema migration is needed. This frontend/backend addition is not yet deployed.

Five focused tests cover revision correctness, shared polling, unchanged revisions, hidden-tab behavior, non-overlap, cleanup and recovery. An isolated-snapshot HTTP test confirmed check-in in Admin activity (12 ms for revision/activity fetch) and check-out in activity/canonical RM detail (234 ms for verification), plus HTTP 401/403 guards. These local API timings exclude the polling interval and production network/cold-start delays.

### My Day performance implementation

**Local refresh control:** `RefreshDataButton` is mounted in the root layout, excluding `/login` and `/`. It dispatches `psspl:refresh-data`, waits for registered loader promises and calls `router.refresh()`. Local tab/filter state is preserved. Admin content reserves bottom space for pagination, mobile safe areas are supported and the button is hidden in print. No production deployment is established by this source update.

`buildSalesDay` creates an RM directory once per request and passes it to customer, sales-summary and overview queries. Other connector callers retain their default behavior. No cache persists between requests, so check-in, visits, follow-ups and connector updates continue to read current records.

The overview product aggregate selects invoices through a scoped customer-ID subquery before joining invoice lines. SQLite uses the existing customer-ID and invoice-ID indexes instead of walking the entire active invoice ledger. Customer ownership, team membership, RM aliases, staging exclusion, grouping, ordering and top-five limit retain the previous semantics. No schema migration or data rewrite is involved.

Express `compression` middleware negotiates supported encodings for compressible responses above 1 KB, using gzip level 1 for low CPU overhead. Requests without compression support receive ordinary JSON; response schemas and reference lists remain complete. `Vary: Accept-Encoding` distinguishes encodings. Sales sidebar links use Next.js navigation to avoid full document reloads.

Regression coverage and measurements are recorded in [the loading-performance report](./docs/superpowers/reports/2026-10-16-my-day-performance.md). Production remains on Render Free compute; idle startup latency is separate from query/transfer latency. The frontend release is published; backend optimization rollout remains pending. No hosting upgrade was performed.

---
## 1. High-Level Architecture & Production Topology

```mermaid
graph TD
    ClientBrowser[Desktop & Mobile Browser / PWA] -->|HTTPS / Edge CDN| VercelFrontend[Vercel Serverless: psspl-crm.vercel.app]
    VercelFrontend -->|Reverse Proxy / Direct API| RenderBackend[Render Node.js 22: psspl-crm-backend.onrender.com]
    RenderBackend -->|Native WAL| DB[(SQLite: data/crm.sqlite + Auto-restore gzip)]
    
    subgraph Data Flow & Integrations
        RenderBackend -->|Authorized evidence| Claude[Claude Messages API - configured backend model]
        RenderBackend -->|Meta Graph API| WhatsApp[WhatsApp Cloud API]
        RenderBackend -->|Minute check, Asia/Kolkata| ReportJobs[Approved Report Schedules]
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
* **AI Engine (current source):** `server/ai-context.mjs` constructs authorized context and re-exports `server/ai-provider.mjs`. Claude mode uses backend-only credentials, the configured Anthropic model and a 30-second timeout; it never silently falls back to Gemini/OpenAI. Legacy providers remain available through explicit configuration. Admin RM Action Plan/Insights use validated evidence-bound recommendations via `server/rm-ai-analysis.mjs`. Provider failures are labeled unavailable. See [Claude operations](docs/operations/claude-ai.md).
* **Scheduler & Automation:** `node-cron` checks approved daily/monthly report schedules every minute in Asia/Kolkata. Delivery defaults to disabled; durable claims and signed callbacks track each occurrence.
* **Media & Voice Recording:** HTML5 `MediaRecorder` API + Web Speech API + `multer` backend audio storage and OpenAI Whisper `whisper-1` transcription.

---
## 3. Database Schema Overview

All application state resides in `data/crm.sqlite` across four primary domains:

### A. Authentication & User Management
* `users`: `id`, `email`, nullable `login_id` (case-insensitive unique, migration 011), `password_hash` (`scrypt`), `role` (`admin` | `rm` | `salesperson`), `active`, nullable `deleted_at` (migration 012), `created_at`. New admin-created accounts are active immediately; existing email logins and pending invitations remain supported. Password changes through `/profile` and recovery/admin resets atomically revoke account sessions, tokens and queued recovery emails. See the [authentication workflow report](docs/superpowers/reports/2026-10-20-authentication-workflow.md). Account deletion disables access and preserves CRM attribution; archived history remains read-only, while admin restoration sets new credentials on the retained identity.
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
* `/admin/*`: Admin dashboards, approvals, user directory, reports and Tally sync. `/admin/team-structure` groups RMs and assigned salespeople; `/admin/archived-employees` exposes preserved employee history through admin-only read APIs.
* `/admin/team`: Executive Team Performance Dashboard with traffic-light achievement pill badges, RM sorting, dedicated **Strategic Thrust Products — RM Leaderboard**, and **Sticky Table Column Headers on Scroll** (headers remain pinned at `top: 0` with `z-index: 10` inside a scrollable container). Features corrected target scaling (Lakhs-to-Rupees) with exact achievement percentages.
* `/admin/team/[id]`: V4 RM performance report with assigned-salesperson scope, saved My Day entries, FY/month/four-week charts, scoped attendance/details, YTD thrust-product company contribution and PDF export. The verbose availability/scope panel is removed. Rais Khan code `033705` additionally receives labeled frontend missing-field fallback; populated values and zeros remain authoritative. See [V4](docs/operations/rm-performance-v4.md) and the [client snapshot adapter/audit](docs/operations/rais-khan-client-snapshot.md).
  * `src/components/reports/rm-my-day-inputs.tsx` renders the eight-column saved-entry table. `server/rm-my-day-entries.mjs` projects one completed visit with its linked order, follow-up and generated lead stage as one row; planned/in-progress visits stay in the My Day route. Independent saved records remain separate.
  * `ThrustSummary` in `src/components/reports/rm-performance-view.tsx` renders Customer & business performance → Thrust Products. `server/rm-performance-report.mjs` receives scoped product results from `calculateThrustProductsForNames` in `server/admin.mjs`, using configured `thrust_products`.
* `/admin/team/[id]/print`: High-definition, A4 printable Executive RM Report Card view featuring full header identity, 8-KPI executive performance cards, Target vs Actual bar breakdown, side-by-side Top Customers and Top Products tables, recent visit transcripts, open follow-up actions, and a fixed top controls bar (`Download PDF` triggering `window.print()` and `Close`).
* `/rm`: RM landing dashboard with assigned-team navigation. `/rm/*` team, report-card and alert routes remain available; My Day is available for field work.
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

### 1. Approved scheduled reporting

`server/app.mjs` runs a minute-based Asia/Kolkata check through `server/report-automation.mjs`:

* Daily reports cover today after the approved send time. Monthly reports cover the prior calendar month and catch up after restart during the following month.
* Protected admin APIs manage disabled-by-default recipient-specific schedules, consent withdrawal and delivery history. Role/team authorization is recalculated on every attempt.
* Migration 004 adds unique occurrences, atomic claims and callback metadata. It was tested only on disposable databases; application to the existing database remains pending approval.
* Only explicit HTTP 429 rejections retry, at most three attempts. Ambiguous outcomes and crash-left sending records require review and are never automatically replayed.
* The Cloud API transport requires explicit deployment enablement, approved templates and recipients, and a reviewed supported API version. Signed callbacks distinguish acceptance from delivery/read and retain early status events.
* Legacy global EOD and free-text report sends are blocked. See [operator runbook](./docs/operations/PSSPL_REPORT_AUTOMATION.md).

### 2. Authorized AI evidence selection

`server/report-snapshot.mjs` builds complete role-scoped JSON using unchanged authoritative Tally metrics and Phase 3/4 review functions. The period, current-state CRM data, sync age and unavailable-data limits are explicit.

* All admin/RM/sales AI routes use `server/ai-answer.mjs` with backend authorization, validated dates/questions and per-account throttling.
* The selected Claude provider selects supported evidence section IDs for Ask AI; the server renders calculated facts and existing review actions. Provider prose, financial values and unsupported causal explanations are not displayed.
* Admin date controls affect backend context. Legacy RM/sales screens default to the Indian financial year. Exact unique RM names and complete monthly targets are required for automation target achievement; unresolved aliases remain unavailable.
* `server/ai-provider.mjs` uses Claude when `CRM_AI_PROVIDER=claude`; Gemini/OpenAI are legacy configuration choices, not silent Claude fallbacks. Missing configuration, timeouts and invalid answers return unavailable errors.
* Source/freshness limits, a top-five product subset and bounded BI support remain visible. Earlier evidence-selection verification mocked provider calls. The later local Claude integration also verified live provider authentication and structured RM analysis; this does not establish production rollout or uploaded speech support in Claude mode.

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


Remaining caching and local follow-up notes: [Architecture continued](./docs/project-records/ARCHITECTURE_CONTINUED.md).

<!-- rm-report-current:start -->
## Historical RM report card - 22-10-2026

- Select an RM (Admin only), Weekly / Monthly / Yearly, financial year, month and week as applicable. Press **View Report** to apply and open the Report Card tab. RM accounts remain restricted to their authorized data.
- Desktop filters are compact; KPIs and chart come first, with insights/actions side by side and stacked mobile sections. PDF retains two A4 pages.
- **Download PDF** also applies pending filters, opens the matching preview and saves from its download button. Export errors provide a retry message; filenames use selected-period dates.
- Executive Territory Coverage groups each executive with their cities beneath the profile and on PDF page 2. The supplied-report date is visible; dealer locations are not substituted as executive assignments.
- Rais Khan reuses existing supplied monthly/weekly/yearly financial data when live invoices are absent; separately labeled sample details remain a documented presentation exception. Missing source achievements stay unavailable. Other RMs receive no sample fallback.
- Latest local checks: all 5 dynamic-period tests, TypeScript and changed-file whitespace checks passed, including dashboard/PDF mapping parity and PDF footer fit.

See [period rules, source limitations and verification](docs/operations/rm-period-reports.md) and [other UI/loading changes](docs/operations/2026-10-22-ui-and-performance.md). The proposed Claude Call Sheet image is a preview, not an implemented feature set. No production deployment or production-data modification was performed for these updates.
<!-- rm-report-current:end -->
