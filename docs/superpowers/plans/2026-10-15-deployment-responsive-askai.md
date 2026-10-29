# 2026-10-15: Ask AI UI Redesign, Full Mobile Responsiveness & Cloud Production Deployment

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

## Release follow-up ? 16 October 2026

Local main now tracks the user-owned DeepakSingh-gh/psspl repository. Explicit Vercel API releases published e17852a (source synchronization), 6c585c1 (RM My Day landing/redirect) and 87eae1e (Manager Action Plan first/default, AI Insights second). The last deployment was verified READY on psspl-crm.vercel.app. Automatic Git linking is permission-blocked and must not be treated as configured.

The Gemini key was saved/verified in Render's environment, but a fresh authenticated AI answer was not verified. Current provider/error handling and My Day performance code are committed but not rolled out to Render. Its automatic deploy trigger was temporarily paused around source pushes and restored afterward to protect the live ephemeral SQLite data. Local development uses .next-runtime; Vercel/production verification used .next, without purging the active dev cache. See [release evidence](../reports/2026-10-16-production-source-sync.md). This documentation refresh performs no commit, push or deploy.

## Objective
Deliver a polished, production-grade cloud deployment of the PSSPL CRM platform with an upgraded Ask AI interface, mobile-first responsive layout (preventing horizontal overflow across all viewports), and full documentation synchronization across GitHub and Vercel.

---

## 1. Ask AI UI Upgrades
- **Command Palette Trigger:** Transformed topbar search input into an interactive command palette trigger with keyboard shortcut (`Ctrl K` on desktop, gracefully hidden on mobile).
- **Date Filtering Presets:** Added quick range buttons (`FY 2026-27`, `Last 30 Days`, `All Data`) to rapidly scope LLM queries to relevant fiscal intervals.
- **Query Management:** Added an instant clear action (`✕`) in the prompt input field with auto-refocusing.
- **Categorized Question Chips:** Replaced plain text queries with visual emoji badges across 7 key business dimensions:
  - 📉 Underperforming products
  - 🌍 Regional demand
  - 🏆 Salesperson & RM leaderboards
  - 💳 Total outstanding collections
  - 🔄 Repeat customer retention
  - 🚶 Real-time field activity progress
  - ⚠️ Dormant dealers with no recent billing

---

## 2. Cross-Device Mobile Responsiveness
- **Sliding Drawer Navigation:** Converted the desktop fixed sidebar into a collapsible off-canvas drawer on mobile (`< 1000px`) with an interactive backdrop overlay (`.admin-sidebar-backdrop`) for tap-to-close interaction.
- **Animated Navigation Toggle:** Replaced plain text "Menu" with clean SVG vector icons transitioning between hamburger lines and close 'X'.
- **Fluid Layout Refactor:**
  - `.rm-kpi-grid`: Reflows from 6 columns on desktop to 3 columns on tablet and 2 columns on mobile.
  - `.rm-3col-grid`: Reflows from 3 columns (`1.1fr 1fr 1fr`) into a single-column stacked layout on tablet/mobile.
  - `.rm-2col-grid`: Reflows from 2 columns to a single column on tablet/mobile.
  - `.rm-thrust-grid`: Fluid `auto-fit` column sizing down to 1-column on narrow screens (`< 480px`).
  - `.rm-stat-3col`: Stacks into 1 column on screens `< 480px`.
  - `.overview-quarterly-grid`: Converted horizontal flex into responsive auto-fit grid (`repeat(auto-fit, minmax(140px, 1fr))`).
- **Viewport Boundary Hardening & Zero Side-Scroll:**
  - Upgraded root viewport rules from `max-width: 100vw; overflow-x: hidden;` to `width: 100%; max-width: 100%; overflow-x: clip;` on `html`, `body`, and `.crm-shell` / `.admin-shell`.
  - Applied `min-width: 0` constraints to all CSS Grid child items.
  - Enclosed tabular cards in `.rm-tables-row` with `overflow-x: auto; -webkit-overflow-scrolling: touch` to allow smooth swipe-scrolling within cards.

---

## 3. Production Deployment Topology
- **Frontend (Vercel):**
  - URL: `https://psspl-crm.vercel.app`
  - Next.js 15 App Router build (27 routes); latest releases were explicit Vercel API deployments. Persistent Git linking remains permission-blocked.
  - Production environment configuration (`.env.production`) targeting the live Render backend API.
- **Backend (Render):**
  - URL: `https://psspl-crm-backend.onrender.com`
  - Node.js 22 runtime with Express 5.1.
  - SQLite database initialized with automated decompression of `data/crm-baseline.sqlite.gz` (57 MB uncompressed) on startup.
- **GitHub Repository:**
  - Repository: `https://github.com/DeepakSingh-gh/psspl`
  - Branch: `main`

---

## 4. Laptop & Desktop Side-Scroll Elimination Architecture
- **Root Cause Analysis:** On 1366px and 1080p (125%/150% scaled) laptop displays (viewport width ~1280px), fixed CSS grid minmax tracks in `.command-story` (`minmax(280px, 4fr)`) and `.command-money-field` (`minmax(340px, 5fr)`) forced `.command` to expand to ~1460px wide. Because `100vw` includes the 17px Windows vertical scrollbar, standard `overflow-x: hidden` allowed horizontal scroll panning.
- **Engineered Resolution:**
  - Replaced `100vw` with `width: 100%; max-width: 100%; overflow-x: clip;` on `html`, `body`, `.admin-shell`, `.admin-main`, and `.admin-content`. `overflow-x: clip` strictly clips without creating a horizontal scroll container, preventing all trackpad and mousewheel side-scrolling while preserving `position: sticky`.
  - Pinned `.admin-sidebar` to `width: 264px; min-width: 264px; max-width: 264px; flex-shrink: 0; left: 0;` ensuring navigation never shrinks or drifts.
  - Expanded the responsive single-column collapse breakpoint from `1100px` to `1280px` (`@media (max-width: 1280px)`).
  - Used flexible `minmax(0, 1fr)` tracks and constrained SVG chart elements (`.command-chart svg`) with `overflow: hidden;`.

---

## 5. Webpack Runtime Cache Isolation
- **Issue:** Running `npm run build` while `npm run dev` is active in the background overwrites `.next` with production hashes. The in-memory chunk map of `next dev` then attempts to require stale development chunks (e.g. `./308.js`), resulting in a runtime module error.
- **Resolution:** When alternating between production build testing and local development, kill stale dev workers, purge the `.next` directory (`Remove-Item -Recurse -Force .next`), and launch `npm run dev` freshly.

## Latest local follow-up ? 16 October 2026

The latest verified published frontend is `87eae1e`. All later refresh-button, login exclusion, attendance-monitor and documentation edits remain local; no new Vercel or Render deployment was performed.

Future attendance rollout requires both the admin-only no-store revision endpoint and subscribing frontend. Polling is shared every two seconds while visible; change-triggered loader revalidation preserves tabs/filters. Preserve live SQLite before a backend deployment.

The fixed Refresh Data control is scoped away from login/root routes and hidden in print. It performs a full reload, unlike attendance-specific automatic revalidation.

Current Sales Reports diagnosis: latest local invoice `2026-09-08`, 78 invoices in September, zero in 1?16 October. GitHub/Vercel source synchronization does not synchronize billing data; no report date fallback was added.

Release context: [source synchronization and deployment status](../reports/2026-10-16-production-source-sync.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
