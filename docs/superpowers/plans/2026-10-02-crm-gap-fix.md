# PSSPL CRM Gap Fix — Implementation Plan

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

## Follow-up status ? 16 October 2026

The completed task list below is historical. Current RM landing is /sales/my-day, and /rm redirects there; the sidebar has My Day and Customer DB. Admin RM detail prioritizes Manager Action Plan (default), then AI Insights, then the remaining tabs. The frontend corrections are live in GitHub/Vercel commit 87eae1e.

AI provider handling is now separated into server/ai-provider.mjs with GEMINI_MODEL/default gemini-2.5-flash, optional OpenAI fallback, placeholder-key rejection and HTTP 503 failures. My Day customer-first aggregation, request-local RM directory reuse and compression are implemented and locally verified, but their backend rollout remains pending. See the [release report](../reports/2026-10-16-production-source-sync.md). This documentation update is local only; no task execution, seeding, push or deployment was performed.

> **STATUS: COMPLETE (ALL TASKS IMPLEMENTED & VERIFIED WITH REAL CLIENT DATA)**

**Goal:** Fix all client-requirement gaps in the PSSPL CRM prototype, closing every ❌ and upgrading every 🟡 from the gap analysis, including dual-mode follow-ups (Visit/Call), daily discussion notes, custom referral sources, and metric branding.

**Architecture:** Five independent sub-systems (A–E) each confined to specific files; they share only the existing database and auth middleware. All backend changes use the `ensureColumn` pattern for schema migrations. All frontend changes follow the existing component pattern in `src/components/`.

**Tech Stack:** Next.js 15 / TypeScript (frontend), Node.js ESM (backend), SQLite `node:sqlite`, OpenAI `gpt-4o-mini`, WhatsApp Cloud API.

**Spec:** `docs/superpowers/specs/2026-10-02-crm-gap-fix-design.md`


## Global Constraints

- Follow existing file/export naming: components are named functions exported as `export function ComponentName()`
- CSS: add new styles to existing `src/app/admin.css` or `src/app/globals.css`; no new files unless noted
- All DB columns added via `ensureColumn()` at bottom of `server/db.mjs`
- All API error responses: `{ error: "message" }` with appropriate HTTP status
- All new `.env` variables: also add to `.env.example`
- After every task: run `npx tsc --noEmit` to confirm no TypeScript errors, then `git add -A && git commit -m "..."`)

## Review Focus

1. RM customers endpoint must filter strictly to RM's team members — never expose other teams' customers
2. Voice note uploads must validate MIME type (audio/*) and cap file size at 25 MB
3. OpenAI calls must have a 30 s timeout and a user-visible fallback if the API is unavailable
4. WhatsApp send must not throw an unhandled exception if credentials are missing — log and return graceful error
5. EOD scheduler must not double-send if the server restarts within the 19:00–20:00 window

---

## Task 1: DB Schema Migrations

**Files:**
- Modify: `server/db.mjs` (add `ensureColumn` calls at the bottom)

**Interfaces:**
- Produces: `visits.visit_tags TEXT`, `visits.voice_note_path TEXT`, `follow_ups.assigned_to_user_id TEXT`

- [ ] **Step 1: Add three `ensureColumn` calls to `server/db.mjs`**

  After the existing `ensureColumn` block (line ~354), add:
  ```js
  ensureColumn("visits", "visit_tags", "TEXT");
  ensureColumn("visits", "voice_note_path", "TEXT");
  ensureColumn("follow_ups", "assigned_to_user_id", "TEXT REFERENCES users(id)");
  ```

- [ ] **Step 2: Verify server starts cleanly**

  Run: `node server/index.mjs`
  Expected: no SQL errors; server listens on port 4000

- [ ] **Step 3: Commit**

  ```bash
  git add server/db.mjs
  git commit -m "feat(db): add visit_tags, voice_note_path, assigned_to_user_id columns"
  ```

---

## Task 2: RM Portal — Backend Endpoints

**Files:**
- Modify: `server/rm-routes.mjs` (add 4 new endpoints)

**Interfaces:**
- Consumes: `db`, `authenticate`, `requireRole("rm")` from existing imports
- Produces:
  - `GET /api/rm/customers` → `{ items: Customer[], total: number }`
  - `GET /api/rm/customers/:id` → `{ customer, monthlySales, visits, activities }`
  - `GET /api/rm/product-trends` → `{ territory: string, trends: ProductTrend[], from: string, to: string }`
  - `GET /api/rm/alerts` → `{ overdueFollowUps[], missedCheckIns[], targetShortfalls[] }`

- [ ] **Step 1: Add team-member helper to `rm-routes.mjs`**

  Add before the existing route:
  ```js
  function getTeamIds(rmUserId) {
    const self = [rmUserId];
    const reports = db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(rmUserId).map(r => r.user_id);
    return [...self, ...reports];
  }
  ```

- [ ] **Step 2: Add `GET /api/rm/customers`**

  ```js
  rmRouter.get("/customers", (req, res) => {
    const teamIds = getTeamIds(req.user.id);
    const q = String(req.query.q ?? "").toLowerCase();
    const page = Math.max(0, Number(req.query.page ?? 0));
    const placeholders = teamIds.map(() => "?").join(",");
    let customers = db.prepare(`SELECT id,name,party_type type,rm_name rmName,city,total_sales totalSales,outstanding,owner_user_id ownerUserId FROM tally_customers WHERE owner_user_id IN (${placeholders}) ORDER BY name`).all(...teamIds);
    if (q) customers = customers.filter(c => `${c.name} ${c.city} ${c.rmName}`.toLowerCase().includes(q));
    const total = customers.length;
    res.json({ total, items: customers.slice(page * 50, page * 50 + 50) });
  });
  ```

- [ ] **Step 3: Add `GET /api/rm/customers/:id`**

  ```js
  rmRouter.get("/customers/:id", (req, res) => {
    const teamIds = getTeamIds(req.user.id);
    const customer = db.prepare("SELECT * FROM tally_customers WHERE id=?").get(req.params.id);
    if (!customer || !teamIds.includes(customer.owner_user_id)) return res.status(403).json({ error: "Not in your team" });
    const monthlySales = db.prepare("SELECT period,amount FROM tally_customer_monthly_sales WHERE customer_id=? ORDER BY period").all(req.params.id);
    const visits = db.prepare("SELECT id,business_date,purpose,outcome,status FROM visits WHERE tally_customer_id=? ORDER BY business_date DESC").all(req.params.id);
    const activities = db.prepare("SELECT * FROM customer_activities WHERE tally_customer_id=? ORDER BY occurred_at DESC").all(req.params.id);
    res.json({ customer, monthlySales, visits, activities });
  });
  ```

- [ ] **Step 4: Add `GET /api/rm/product-trends`**

  ```js
  rmRouter.get("/product-trends", (req, res) => {
    const profile = db.prepare("SELECT region,territory FROM salesperson_profiles WHERE user_id=?").get(req.user.id);
    const region = profile?.region ?? "";
    const fyStart = (() => { const now = new Date(); const y = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear()-1; return `${y}-04-01`; })();
    const today = new Date().toISOString().slice(0, 10);
    const trends = db.prepare(`
      SELECT p.name, COALESCE(SUM(l.amount),0) salesValue, COALESCE(SUM(l.quantity),0) quantity, COUNT(DISTINCT i.id) invoiceCount
      FROM tally_products p
      LEFT JOIN tally_invoice_lines l ON l.product_id=p.id
      LEFT JOIN tally_invoices i ON i.id=l.invoice_id AND i.invoice_date BETWEEN ? AND ?
      LEFT JOIN tally_customers c ON c.id=i.customer_id
      WHERE c.rm_name LIKE ? OR c.destination_code LIKE ?
      GROUP BY p.id ORDER BY salesValue DESC LIMIT 30
    `).all(fyStart, today, `%${region}%`, `%${region}%`);
    res.json({ territory: region, trends, from: fyStart, to: today });
  });
  ```

- [ ] **Step 5: Add `GET /api/rm/alerts`**

  ```js
  rmRouter.get("/alerts", (req, res) => {
    const teamIds = getTeamIds(req.user.id);
    const today = new Date().toISOString().slice(0, 10);
    const ph = teamIds.map(() => "?").join(",");
    const overdueFollowUps = db.prepare(`SELECT f.id,f.title,f.due_date,u.email,p.full_name fullName,c.name customer FROM follow_ups f LEFT JOIN users u ON u.id=f.user_id LEFT JOIN salesperson_profiles p ON p.user_id=f.user_id LEFT JOIN tally_customers c ON c.id=f.tally_customer_id WHERE f.user_id IN (${ph}) AND f.completed=0 AND f.due_date<?`).all(...teamIds, today);
    const missedCheckIns = db.prepare(`SELECT u.id,u.email,p.full_name fullName,p.territory FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id IN (${ph}) AND u.active=1 AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id=u.id AND a.business_date=?)`).all(...teamIds, today);
    const targetShortfalls = db.prepare(`SELECT u.id,u.email,p.full_name fullName,p.monthly_target monthlyTarget FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id IN (${ph}) AND p.monthly_target>0`).all(...teamIds);
    res.json({ overdueFollowUps, missedCheckIns, targetShortfalls });
  });
  ```

- [ ] **Step 6: Register new RM routes in `server/app.mjs`**

  Check `server/app.mjs` — if `rmRouter` is already mounted at `/api/rm`, nothing to do. Verify.

- [ ] **Step 7: Manual test — verify all 4 endpoints return data for an RM user**

  Start server; login as an RM user; `curl http://localhost:4000/api/rm/customers` with the session cookie.
  Expected: 200 with `{ total, items }`.

- [ ] **Step 8: Commit**

  ```bash
  git add server/rm-routes.mjs
  git commit -m "feat(rm): add customers, product-trends, alerts endpoints"
  ```

---


Frontend implementation tasks continue in [the frontend plan](./2026-10-02-crm-gap-fix-frontend.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
