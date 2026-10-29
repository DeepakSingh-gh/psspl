# PSSPL CRM README — continued

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Continuation of [README.md](../../README.md).

### 3. Shared RM & Field Sales Workspace (`/sales/my-day` and `/sales/hub`)
- **Day Planner & GPS Attendance:** One-tap GPS check-in and check-out with time and route tracking. Clock-in and clock-out timestamps are persisted and displayed on both sales and manager dashboards.
- **Metric Cards & Order Tracking:** Live tracking of daily visits, completion status, **Order Expected** value (in Lakhs), and target achievement.
- **Harmonized Monthly Performance Review:** "MY PERFORMANCE - Monthly target" card accurately displays live rupee metrics (`Actual from Tally`, `Target`, `Gap` / `Surplus`) using standardized Indian currency formatting (`formatRupees`) in perfect agreement with top-line metrics (e.g. ₹62.15 L / ₹45.93 L / 135%). Includes active ledger temporal badge (`2026-09 active ledger`), dynamic surplus calculation (`Surplus (+35%)` with `+₹16.22 L` when actual exceeds target), and green `✓ Target Achieved` pill badge with dynamic progress bar styling.
- **Dual-Mode Follow-ups System (Visit & Call):** Action list follow-ups supporting channel selection (**🚗 Field Visit** vs **📞 Phone Call**), priority tagging (`High`, `Medium`, `Low`) with color-coded badges, and editable priority dropdowns. Interactive **Discussion Description Boxes** feature Honolulu Blue border styling (`1.5px solid #007CBA`), focus halo ring, left-accented notes display (`.followup-notes-display`), and fully editable **Next Follow-up due dates**.
- **Customer Visits & Modal Experience:**
  - Robust **Add Unplanned Visit** modal tied directly to active reference customers with synchronized multi-tier access control (allowing RMs and field sales representatives to plan visits across all customers in their territory, assigned accounts, and subordinates).
  - Instant synchronization between Field Sales Workspace and Admin Panel (`/admin/team/[id]`): visits planned by RMs or field sales reps immediately reflect on the manager's report card under *Customer Visits* and daily KPIs.
  - Custom **`AnimatedSelect`** dropdown with silky-smooth cubic-bezier open/close transitions, rotating chevron, and focus rings.
  - Quick visit logging with operational tags, date/time selection, priority level tracking, clearly delineated field input borders on Unplanned Visit dialogs, and built-in **audio voice note recording**.
  - Includes full inline Edit and Delete capabilities for Unplanned Visits on the workspace with form state auto-reset.
- **Regional Manager Detail & Report Card (`/admin/team/[id]`):** V4 uses FY/month/four-week chart navigation, assigned-salesperson scope, scoped attendance with a detail sheet, compact YTD thrust-product contribution and PDF export. Rais Khan's labeled client fallback fills missing fields only. Earlier Today/Week layouts are dated history. See [current behavior and verification](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026).
- **Service & Support Requests:** Track customer complaints, technical trials, and commercial quotation requests.

### 4. AI Executive Intelligence & Copilot
- **Redesigned Ask AI Command Center (`HeaderAiAsk`):** Accessible on every page header (`topbar`) with a streamlined trigger pill, keyboard shortcut hint (`Ctrl K` on desktop, auto-hidden on mobile), and quick modal launcher.
- **Enhanced Search Experience & Quick Presets:** Includes one-click clear button (`✕`), instant date-range filter presets (*FY 2026-27*, *Last 30 Days*, *All Data*), and categorized prompt chips featuring visual emoji badges (*📉 Underperforming products*, *🌍 Regional demand*, *🏆 RM leaderboards*, *💳 Outstanding dues*, *🔄 Customer retention*, *🚶 Field ops*, *⚠️ Dormant accounts*).
- **Executive Card Formatting (`AiResponseFormatter`):** Converts raw LLM output into structured **Executive Action Cards** with blue **Data Point** badges, green **Recommended Action** boxes, and inline currency/count metric pills (`askai-metric-pill`).
- **Instant Query Execution:** Clicking suggested prompt chips immediately fills the input and triggers live database intelligence retrieval.
- **One-Click Copy & Data Provenance:** Integrated **Copy** button with instant state feedback and live SQL data provenance details.
- **Grounded SQL Data Engine:** Context synthesized directly from real-time database tables (`tally_invoices`, `tally_products`, `tally_customers`, `leads`, `follow_ups`, `salesperson_profiles`).
- **AI Provider Engine:** Local source separates context construction (`server/ai-context.mjs`) from provider requests (`server/ai-provider.mjs`). `GEMINI_MODEL` optionally selects a model, with `gemini-2.5-flash` as the default/fallback model and OpenAI `gpt-4o-mini` as an optional provider fallback. Gemini keys are sent in request headers. Missing configuration or exhausted providers return HTTP 503 rather than an AI answer; the backend code rollout is still pending.
- **Voice Speech-to-Text Search (`<VoiceMicButton>`):** Reusable voice recording mic button integrated on all search boxes across Sales Hub, Ask AI, RM Directory, Admin Customers, and Admin Products. Supports instant free browser Web Speech API with backend OpenAI Whisper API (`POST /api/stt`) fallback.
- **Approved report automation:** A minute-based `node-cron` check in `server/app.mjs` processes approved recipient-specific daily/monthly reports in Asia/Kolkata. Persistent claims prevent duplicate processing, explicit rate-limit rejections retry safely, and signed callbacks track delivery. External delivery is disabled by default.

### 5. Mobile-First & Cross-Device Responsiveness
- **Adaptive Screen Viewports:** Fully fluid layout scaling down to 360px mobile viewports (Brave, Chrome, Safari on iOS/Android).
- **Off-Canvas Navigation Drawer:** Collapsible sidebar on mobile devices with an interactive backdrop blur overlay (`.admin-sidebar-backdrop`), swipe/tap to dismiss, and an animated vector hamburger toggle button.
- **Fluid Multi-Tier Grids:**
  - `.rm-kpi-grid`: Reflows dynamically from 6 columns on desktop down to 3 columns on tablet and 2 columns on mobile.
  - `.rm-3col-grid`: Stacks cleanly from 3 columns into 1 column on tablet and mobile viewports.
  - `.rm-thrust-grid`: Auto-fits strategic focus products into responsive columns with zero horizontal scroll.
  - `.overview-quarterly-grid`: Adapts quarterly trend cards to mobile screens without squishing.
- **Zero Side-Scroll Architecture:** Hardened with `width: 100%; max-width: 100%; overflow-x: clip;` across `html`, `body`, and `.admin-shell`, completely eliminating the side-scroll bug on Windows/Blink laptops caused by standard 17px vertical scrollbars. Combined with desktop sidebar pinning (`264px` fixed geometry), responsive grid track collapses (`minmax(0, 1fr)`) at `<= 1280px`, and overflow-clipped SVG charts.
- **Table Scroll Protection:** Scoped `overflow-x: auto` table card containers allow smooth horizontal swiping on high-density data tables without pushing parent viewports or sidebars off-screen.

## ⚙️ Environment Variables

The following is a configuration reference for a separately approved setup. Existing `.env` files and credentials were not changed during Phase 7. Keep delivery disabled until recipient/template approval and migration review:

```ini
# Server & API Configuration
PORT=4000
CRM_ADMIN_EMAIL=admin@psspl.com
CRM_ADMIN_PASSWORD=psspl-admin-2026
CRM_DATABASE_PATH=./data/crm.sqlite

# Google Gemini API Integration (Ask AI Assistant)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# OpenAI Integration (Optional Fallback)
OPENAI_API_KEY=your_openai_api_key_here

# Meta WhatsApp Cloud API (disabled until approvals and controlled rollout)
WHATSAPP_DELIVERY_ENABLED=false
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_meta_system_user_token
# Set a reviewed supported Graph version only during approved setup.
# WHATSAPP_GRAPH_VERSION=vNN.0
# WHATSAPP_APP_SECRET=configure_server_side_only
# WHATSAPP_WEBHOOK_VERIFY_TOKEN=configure_server_side_only
```

For the deployed app, set `GEMINI_API_KEY` in the **Render backend service → Environment**, then save and redeploy. A key in your laptop's `.env` or the Vercel frontend does not configure the Render backend. Keep API keys server-side; do not use a `NEXT_PUBLIC_` prefix. `GEMINI_MODEL` optionally overrides the default model, and `OPENAI_API_KEY` enables the fallback provider. Missing configuration and provider failures return HTTP 503 and appear as errors rather than AI answers.

---

## 🧪 Verification & Testing Commands

* **TypeScript:** `npx tsc --noEmit`
* **Build:** `npm run build`
* **Isolated Phase 7 tests:** `npm run test:phase7`
* **Regression suites:** `npm run test:security`, `npm run test:phase2` through `npm run test:phase6`; `node --test scripts/ai-provider.test.mjs scripts/attendance-live.test.mjs`
* **Development server:** `npm run dev` starts the backend and can apply pending migrations. Do not run against the existing CRM database until backup/migration approval.
* **Data importer:** `npm run import:data` changes data; it is not a verification command and was not run in Phase 7.
* **Backend Health Check:** `curl http://localhost:4000/api/health`
* **Purge Next.js Cache (if alternating build & dev):** `Remove-Item -Recurse -Force .next` (PowerShell) / `rm -rf .next` (Bash)

## Latest local follow-up ? 16 October 2026

**Current refresh behavior (21 October):** Refresh Data reruns registered client data loaders and requests a route refresh, preserving tabs and filters. It is excluded from `/login` and `/`, hidden in print, and has pagination clearance in admin layouts.

**Attendance freshness:** Overview, Team, RM detail, Field Activity and Alerts subscribe to a shared two-second visible-tab revision check. A persisted clock-in/out change refreshes their data; latency also includes network and API processing. The new frontend/backend code is uncommitted and not deployed.

**Why Sales Reports showed zero:** A read-only local database check found the latest committed invoice on **8 September 2026**, **78 invoices in September**, and **0 invoices for 1?16 October 2026**. The selected October range correctly produces an empty report. Use **Last month** for September; October reporting requires syncing October invoices. No date fallback, invoice import or report-code change was made for this finding.

**Publication boundary:** Last verified live frontend/source commit is `87eae1e`. This Markdown refresh and the pending local feature changes have not been committed, pushed or deployed.

Release context: [source synchronization and deployment status](../superpowers/reports/2026-10-16-production-source-sync.md).

## Current local status - Phase 7, 17 October 2026

Phase 7 is a **CONDITIONAL PASS** for local implementation: authorized AI evidence selection, approved daily/monthly report scheduling, durable delivery/retry/callback handling, scoped in-app reminders and task-oriented training SOPs. Verification passed 68 automated tests plus the separate My Day smoke check, TypeScript, 29 syntax checks and whitespace validation.

All work remains local and uncommitted on `feature/psspl-phase3-rm-report-cards`. No deployment, existing-database migration, real WhatsApp message or paid provider request was performed. Delivery is disabled by default. Recipients/opt-in/templates/schedules, reviewed provider configuration, backup/migration rollout, data freshness/mapping decisions, browser acceptance and training sign-off remain outstanding. Final UAT has not started and awaits user approval.

- [Phase 7 verification and changed files](./PSSPL_PHASE7_VERIFICATION.md)
- [Report automation operator runbook](../operations/PSSPL_REPORT_AUTOMATION.md)
- [RM/SE SOP](../training/PSSPL_RM_SE_SOP.md)
- [RM/Manager SOP](../training/PSSPL_RM_Manager_SOP.md)
- [Admin SOP](../training/PSSPL_Admin_SOP.md)

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
