# PSSPL CRM Gap Fix — Design Specification (continued)

Continuation of [the design specification](./2026-10-02-crm-gap-fix-design.md).


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

... (truncated to stay under 200 lines)

## Latest local follow-up ? 16 October 2026

Current UI constraints now exclude the global refresh control from login/root routes and print. It remains fixed on data pages; a manual document reload can reset unsaved form state.

Admin attendance freshness uses a shared two-second visible-tab monitor of an admin-only persisted-revision endpoint. A change invalidates subscribed data caches while preserving selected tabs/filters; unchanged attendance does not repeatedly run full dashboard queries. Focus/reconnect checks immediately; network/API latency still applies.

Sales Reports must retain their explicit selected dates. Local October zero totals are consistent with latest invoice date `2026-09-08` and no invoices for 1?16 October; a missing period must not silently display September totals as October.

This addendum documents local source behavior and verified findings, not a new production release or execution of the historical plan.

Release context: [source synchronization and deployment status](../reports/2026-10-16-production-source-sync.md).

> Current project status (19 October 2026): See the [production readiness report](../../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
