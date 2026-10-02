# PSSPL CRM Gap Fix — Design Specification

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

---

## Sub-System D — Real Ask AI (OpenAI)

### What it does
Replace the keyword-matching `ask-ai` route with a real OpenAI `chat/completions` call that
includes a structured context block of live CRM+Tally data.

### Architecture
1. **Context builder** (`server/ai-context.mjs`) — assembles a JSON summary: top/declining
   products, team performance vs. target, overdue follow-ups count, inactive customers, pipeline
   totals by stage, territory shortfalls. Kept under ~2,000 tokens.
2. **System prompt** — identifies the AI as a PSSPL CRM analyst; instructs it to answer from
   context, cite data, and if asked to draft an email, produce Markdown.
3. **Admin Ask AI** — `POST /api/admin/ask-ai` wired to OpenAI with company-wide context.
4. **Sales Ask AI** — `POST /api/sales/ask-ai` updated to use salesperson-scoped context.
5. **RM Ask AI** — `POST /api/rm/ask-ai` with RM-scoped context (team only).
6. **Frontend** — existing `admin-ask-ai.tsx`, `sales-ask-ai.tsx` already have UI shells; wire
   them to stream the response (no streaming needed — single JSON response is fine).

### OpenAI config
- Model: `gpt-4o-mini` (cost-efficient; fast)
- API key: `OPENAI_API_KEY` env var (add to `.env.example`)
- Timeout: 30 s; on timeout/error return a graceful fallback message

### Six supported question types (system prompt enumerates these)
1. Which RM needs attention and why?
2. Which territory needs support for a product?
3. Which products sold less than last month/year?
4. Which customers reduced repeat orders?
5. What is the likely year-end shortfall?
6. Draft an email to an RM about a gap.

---

## Sub-System E — Delivery, Export & Automation

### E1 — WhatsApp Business API delivery
- Config: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_RECIPIENT_NUMBER` in `.env`
- `server/whatsapp.mjs` — `sendMessage(text)` wraps the Cloud API `POST /messages` call
- Trigger: `POST /api/admin/reports/send-whatsapp` accepts `{ reportId }`, fetches the
  stored report payload, formats as text summary, sends via WhatsApp
- Admin UI: "Send via WhatsApp" button on each saved report in `admin-management-reports.tsx`

### E2 — PDF export
- Use the browser's `window.print()` with a `@media print` stylesheet for clean single-column
  report layout; no server-side PDF library needed
- Add a `<button onClick={() => window.print()}>Export PDF</button>` to every report view
- `@media print` CSS added to `admin.css`: hides sidebar, nav, buttons; formats tables cleanly

### E3 — CSV export
- For tabular reports (by product, salesperson, customer, region): add a "Download CSV" button
- Pure client-side: convert the JSON array to CSV string, trigger `<a download>` with a Blob URL
- Helper: `src/lib/csv.ts` — `exportCsv(rows: Record<string, unknown>[], filename: string)`

### E4 — End-of-day automated activity summary
- `server/scheduler.mjs` — uses `node:timers` `setInterval` to run the EOD job every hour;
  checks if current time is 19:00-20:00 IST; if so, generates activity summaries for all
  checked-in salespeople and stores them as `generated_reports` entries with type `eod_summary`
- If WhatsApp is configured, sends the consolidated team summary to management
- Scheduler is started from `server/index.mjs`

### E5 — Session hardening (minimum viable)
- Password minimum length: 8 characters; checked at `POST /api/auth/password` (change) and
  `POST /api/admin/users` (create)
- Session expiry: `sessions` table already has `expires_at`; current sessions are set to 24h;
  reduce to 8h on new login; add middleware to reject expired tokens
- Rate limit login: 5 attempts per IP per 15 minutes using an in-memory map in `server/auth.mjs`

---

## Testing Strategy

Each sub-system will have:
- Manual smoke-test checklist (described in plan tasks)
- TypeScript compilation passing (`tsc --noEmit`)
- Server startup without errors

No automated test framework is currently in the project; unit tests are not required for this
delivery but each task ends with a manual verification step and a git commit.
