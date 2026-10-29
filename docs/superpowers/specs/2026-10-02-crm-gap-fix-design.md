# PSSPL CRM Gap Fix — Design Specification

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

## Current behavior addendum ? 16 October 2026

This specification records the original portal design. The subsequent approved UI correction supersedes its standalone RM home: RM sign-in opens /sales/my-day with My Day and Customer DB navigation; /rm redirects to that workspace. Specialized RM report/detail routes remain implemented. Admin RM report tabs now start with Manager Action Plan (default) and AI Insights before the six remaining tabs.

Current source uses server/ai-provider.mjs for configurable Gemini calls and optional OpenAI fallback, while server/ai-context.mjs builds context and prompts. Missing configuration/provider failures return HTTP 503, not successful intelligence cards. Frontend corrections are live at commit 87eae1e; backend changes await a separate Render rollout. See the [source-sync report](../reports/2026-10-16-production-source-sync.md). This addendum is local only; it does not rerun the historical implementation plan.

**Date:** 2026-10-02  
**Status:** Approved for planning  
**Gap analysis source:** `gap_analysis.md`

---

## 0. Scope and Decomposition

This spec covers all 15 gaps identified against the client requirement document. The work
is split into **5 independent sub-systems** that can be implemented in parallel:

| Sub | Name | Gaps fixed |
|-----|------|------------|
| A | RM Portal (full UI) | RM-scoped portal, RM product-trend filter |
| B | Lead & Pipeline Kanban | Lead capture, Kanban, new-lead pipeline, unconverted-commitments view |
| C | Quotation, Complaint & Visit Tagging | Visit type tags, quotation tracking, complaint tracking, responsible-person on follow-up, voice note |
| D | Real Ask AI (OpenAI) | All 6 Ask AI use-cases wired to real LLM + data query layer |
| E | Delivery, Export & Automation | WhatsApp Business API, PDF/CSV export, EOD auto-report, session hardening |

---

## Global Constraints

- Language: TypeScript (frontend), Node.js ESM (backend)
- Database: SQLite via `node:sqlite` (`DatabaseSync`); use `ensureColumn` pattern for schema migrations
- Auth: existing `authenticate` + `requireRole` middleware in `server/auth.mjs`
- API base: `NEXT_PUBLIC_API_URL` -> `http://127.0.0.1:4000/api`
- Styling: existing CSS classes in `src/app/admin.css` / `src/app/globals.css`; no new CSS framework
- No new npm dependencies without explicit approval; prefer packages already in `package.json`

---

## Sub-System A — RM Portal (Full UI)

### What it does
An RM (Regional Manager) who logs in sees their own team data only — not all company data. The
`/rm` route currently renders a stub. The backend (`server/rm-routes.mjs`) already has a
working `/api/rm/dashboard` endpoint that returns manager info, team members with CRM and Tally
metrics, and pipeline by stage.

### UI pages to build
1. **`/rm` (Home)** — KPI cards (team sales, customers, outstanding, visits, open follow-ups),
   date-range picker (Indian financial-year default), pipeline funnel (leads by stage), team
   check-in status table.
2. **`/rm/team` (My Team)** — already has a component (`rm-dashboard.tsx`) but it is the entire
   RM experience. Split into: the existing team table stays on `/rm/team`, and `/rm` gets a new
   home dashboard.
3. **`/rm/customers` (Customer DB)** — list of customers assigned to the RM's team (filter:
   `owner_user_id IN (team member IDs)`); search + territory filter; click -> customer detail
   (reuse admin customer detail layout).
4. **`/rm/products` (Product trends)** — reuse `admin-product-trends.tsx` but scoped to the
   RM's territory/region (add `region` query param to `/api/rm/product-trends` new endpoint).
5. **`/rm/alerts` (Alerts)** — overdue follow-ups, missed check-ins, target shortfalls, inactive
   customers — all scoped to the RM's team.

### New backend endpoints
- `GET /api/rm/customers` — customers WHERE owner_user_id IN (team members); params: `q`, `page`
- `GET /api/rm/customers/:id` — customer detail (same as admin but access-checked to RM's team)
- `GET /api/rm/product-trends` — reuse admin product-trends query but filter by `region` from RM profile
- `GET /api/rm/alerts` — overdue follow-ups/orders/requests for RM's team members

### Navigation
RM sidebar: Home · My Team · Customer DB · Product Trends · Alerts · My Day (link to `/sales/my-day`)

---

## Sub-System B — Lead & Pipeline Kanban

### What it does
Salespeople capture new leads (from exhibitions, calls, walk-ins). Each lead moves through a
pipeline: `lead -> technical_discussion -> sample -> quotation -> follow_up -> expected_order -> won | lost`.
The pipeline is already in the DB (`leads` table, `stage` column). The backend endpoints for
CRUD and stage-move exist in `sales-routes.mjs`. What is missing is all of the UI.

### UI components to build
1. **`LeadBoard`** — Kanban board with one column per stage; each card shows name, company,
   expected value, next-action date, product interest. Drag is not required — a "Move to next
   stage" button is sufficient.
2. **`LeadForm`** — modal/drawer: name, company, phone, email, city, source (dropdown:
   Exhibition / Referral / Walk-in / Cold call / Other), interested product (from Tally product
   list), expected value, next-action date, notes.
3. **`LeadDetail`** — click-to-expand card showing full activity history for the lead
   (uses `customer_activities` filtered by `lead_id`).
4. **Unconverted Commitments panel** — expected orders where `status='open'` and
   `expected_date < today`; shown in the salesperson's My Day workspace and in the RM alerts panel.

### Route
`/sales/my-day` gets a new "Pipeline" tab alongside the existing visits/follow-ups.
The Lead Board lives at this tab. No new page route needed.

### API additions
- `GET /api/sales/leads/:id` — single lead detail with activities
- `GET /api/sales/leads/:id/activities` — activity history for a lead
No new server-side routes needed beyond those; `PATCH /api/sales/leads/:id/stage` and
`POST /api/sales/leads` already exist.

---

## Sub-System C — Quotation, Complaint & Visit Tagging

### What it does
Three improvements to the visit + service-request workflow:

#### C1 — Visit type tags
Add a `visit_tags` column (`TEXT`, comma-separated enum values) to the `visits` table.
Tags: `sample_required`, `quotation_required`, `technical_support`, `complaint`.
The complete-visit form in `sales-workspace.tsx` gets checkboxes for these tags.
The admin activity view and RM alerts surface visits with active tags.

#### C2 — Quotation tracking
A quotation is a `service_request` with `request_type = 'quotation'`. The `service_requests`
table already exists with `responsible_person` and `due_date`. Build a UI card in the salesperson
workspace (new "Requests" tab in My Day) listing open quotations/complaints/tech-support items.
Add a "New request" form accessible from the visit-complete flow.

#### C3 — Responsible person on follow-up
Add `assigned_to_user_id TEXT REFERENCES users(id)` column to `follow_ups` via `ensureColumn`.
The follow-up form (in complete-visit modal) gets an "Assign to" dropdown showing team members
(for RM users; for salesperson it defaults to self and is read-only).
The RM dashboard shows follow-ups by assignee.

#### C4 — Voice note on visit
Add `voice_note_path TEXT` column to `visits` via `ensureColumn`.
Backend: `POST /api/sales/visits/:id/voice-note` accepts `multipart/form-data` with an audio file,
saves to `data/voice-notes/<id>.<ext>`, stores relative path.
Frontend: after completing a visit, show an optional "Add voice note" button that opens the browser
media recorder; on stop, uploads the blob.

#### C5 — Dual-mode follow-up channel & daily discussion notes
Add `follow_up_type TEXT DEFAULT 'call'` (`'call'` | `'visit'`) and `notes TEXT` columns to `follow_ups` via `ensureColumn`.
Backend: `PATCH /api/follow-ups/:id` and `POST /api/follow-ups` accept `followUpType` and `notes`.
Frontend: Follow-up action list items render channel badges (**🚗 Field Visit** / **📞 Phone Call**) and expandable/inline **Discussion Description Boxes** with **"✏️ Edit Notes"** and **"Save Notes"** buttons so RMs and Field Execs can write down daily discussion details.

---

## Sub-System D — Real Executive Ask AI (Google Gemini API & AI Response Formatter)

### What it does
Replaces keyword-matching logic with a real LLM integration powered by Google Gemini REST API (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-3.6-flash`) with fallback to OpenAI (`gpt-4o-mini`). Includes structured context synthesized directly from live SQL database tables (`tally_invoices`, `tally_products`, `tally_customers`, `leads`, `follow_ups`, `salesperson_profiles`).

### Architecture
1. **Context builder** (`server/ai-context.mjs`) — assembles JSON metrics: top/declining products, team performance vs. target, overdue follow-ups count, inactive customers, pipeline totals by stage, territory shortfalls directly from live SQL queries.
2. **System prompt** — identifies AI as an executive PSSPL business analyst; instructs it to cite exact numbers, use structured numbered points (1., 2., 3.), bold headers, Data Points, and Action Items without double asterisks or raw code symbols (`'[]'`).
3. **Executive AI Formatter (`src/components/ai-response-formatter.tsx`)** — parses LLM output into styled **Executive Insight Cards** featuring blue **Data Point** badges, green **Recommended Action** boxes, inline currency/number metric pills (`askai-metric-pill`), and a one-click **Copy to Clipboard** action.
4. **Integrated Search Controls & Instant Execution** — `.askai-field` features an integrated, un-missable gradient **Search** button (`.askai-submit-btn`) with sparkle icon. Clicking any suggested prompt chip populates the field and executes live database intelligence search immediately.
5. **Loading Shimmer State** — displays an animated purple spinner (`askai-loading`) while fetching live intelligence.
6. **Multi-Portal Integration** — `AdminAskAi` (`admin-ask-ai.tsx`), `SalesAskAi` (`sales-ask-ai.tsx`), and `RmAskAi` wired to live context.

### LLM & Model Config
- Primary Engine: Google Gemini API via `GEMINI_API_KEY` (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-3.6-flash`)
- Fallback Engine: OpenAI `gpt-4o-mini` via `OPENAI_API_KEY`
- Timeout: 12-30 s per model with graceful failover

### Supported question types
1. Which RM or territory needs attention and why?
2. Which products sold less than last month/year?
3. Which customers reduced repeat orders?
4. What is the likely year-end shortfall?
5. Which territory needs support for a product?
6. Draft a management email about a performance gap.

---

## Sub-System E — Delivery, Export & Automation

The delivery/export and session-hardening design continues in [the continuation](./2026-10-02-crm-gap-fix-design-continuation.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
