# PSSPL CRM universal responsive UI/UX design

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Status: approved by the user on 20 November 2026; implementation and verification tracked in the corresponding plan and evidence folder.

Builder check: independent reviewer reported "nothing important left". Baseline TypeScript check (`tsc --noEmit --incremental false`) passed on 20 November 2026. Product code has not been changed; browser validation is pending.

## Intent and constraints

Execute the supplied Universal Responsive UI/UX Optimization master prompt across the existing CRM. Improve usability from 320px through 1920px and larger while retaining desktop identity, brand tokens, typography, icons, navigation destinations, data, and functionality. Work in the existing codebase. Do not change APIs, schemas, authorization, authentication, calculations, AI generation, report generation, or stored records. Do not introduce application demo data or dependencies.

## Current architecture and evidence

- Next.js App Router, React, TypeScript, plain shared CSS and selected CSS modules. Root layout imports globals, auth, insights, hub and admin styles. No lint script is configured.
- AdminShell supplies the admin layout, page headers, KPI tiles and shared state components. Its mobile drawer starts at 1000px, has a backdrop and closes on pathname changes. It currently lacks an in-drawer close control, background scroll locking and keyboard focus containment. The mobile topbar hides sign out without a sidebar alternative.
- RmShell uses admin sidebar styles but has no drawer state or opening control. The shared CSS translates its sidebar offscreen at mobile/tablet widths.
- SalesSidebar is reused by My Day and Customer DB. Below 680px it becomes a sticky, wrapping header with horizontal navigation rather than the requested drawer.
- Existing responsive work is substantial; retain working rules and local scrolling. The RM performance chart already has minimum-width local scrolling; attendance heatmaps and the lead board have their own viewports.
- SalesWorkspace contains an inline two-column follow-up form. Audit inline layout rules alongside stylesheet rules.
- Report CSS defines fixed 794px A4 PDF canvases. Keep export dimensions and pagination intact; improve only the on-screen viewport and toolbar around them.
- The root route redirects to login. RM home redirects to Sales My Day; preserve both redirects. Legacy RM components must not replace the current landing flow.
- Repository was clean at inspection on feature/psspl-phase3-rm-report-cards. No AGENTS.md was found within the workspace file inventory. Secrets in .env are outside this work.

## Approaches

1. Extend current shells and component styles, then make targeted route fixes. Recommended builder choice: retains tokens, desktop layout and existing behavior, with small reusable fixes and a route-level verification matrix.
2. Add broad global CSS overrides only. Less initial editing, but inline layouts, offscreen navigation and focus behavior need component changes; broad overrides risk print regressions. Rejected as insufficient.
3. Replace the UI framework or rebuild layouts. Larger desktop and behavior changes contradict the preservation requirements. Rejected.

## Proposed behavior

### Navigation and app shells

Preserve existing desktop rails. On smaller screens, provide labelled hamburger and close controls for all three shells. Keep every current link and active state. Close on navigation, backdrop and Escape; contain keyboard focus, restore focus to the opener, prevent background scrolling while open, and release the modal behavior when resized to desktop. Ensure closed offscreen navigation cannot receive keyboard focus. Reuse a small shared interaction primitive if this reduces duplication; keep role-specific links and auth code in their current owners.

Mobile sketch:

    [Menu] [existing header controls, wrapping as needed]
    [page heading]
    [filters / search]
    [KPI cards, compact or stacked]
    [charts and tables with their own scroll viewport]

Open drawer:

    [existing logo] [Close]
    [all existing navigation links]
    [existing account actions]

### Content, tables and charts

Use existing tokens and breakpoints; add rules only where inspection or browser checks identify a gap. Allow flex/grid children to shrink using min-width:0 and minmax(0,1fr). Wrap headings, actions, identities, filters and long explanatory text. Use single-column small-screen forms and appropriate tablet grids. Retain readable financial values.

Keep all table columns. Complex tables retain minimum readable widths inside bounded horizontal scroll regions. Preserve sticky headings, sorting, filters, search and paging. Do not use body overflow clipping to conceal layout defects.

Charts size to available content width where labels remain legible; otherwise keep a readable minimum width inside a chart viewport. Preserve values, axes semantics, focus/hover details and touch interactions. Adapt tooltip placement and legends where necessary.

### Modals, reports and account surfaces

Constrain dialogs to viewport width and dynamic viewport height, with internal scrolling and reachable close/action controls in portrait and landscape. Preserve form validation and submit handlers. Keep dropdowns within available space and inputs usable on touch devices.

RM Report Card, AI Insights, Manager Action Plans, feedback schedules and attendance must wrap and scroll appropriately. PDF previews may pan a full-size printable canvas within a bounded viewport; headers and download controls must remain reachable. Screen-only styling must not affect exported A4 layout, hidden measurement elements, page dimensions or PDF pagination.

## Complete route checklist

Each route below needs source review and a recorded browser result or an explicit verification limitation. Review every relevant tab, drawer, filter and modal in its owning component, including dynamic drill-downs. A redirect requires destination and redirect verification rather than an invented screen.

| Group | Routes | Current status |
| --- | --- | --- |
| Entry/account | /, /login, /activate-account, /forgot-password, /reset-password, /profile | Route owners mapped; detailed audit and browser checks pending |
| Admin overview/intelligence | /admin, /admin/team, /admin/team/[id], /admin/customers, /admin/products, /admin/trends | Route owners mapped; detailed audit and browser checks pending |
| Admin operations | /admin/activity, /admin/alerts, /admin/ask-ai, /admin/users, /admin/team-structure, /admin/archived-employees, /admin/tally, /admin/audit | Route owners mapped; detailed audit and browser checks pending |
| Admin reports | /admin/reports, /admin/management-reports, /admin/rm-feedback, /admin/team/[id]/print | Route owners mapped; detailed audit and browser checks pending |
| RM | /rm, /rm/team, /rm/report-card, /rm/customers, /rm/products, /rm/alerts, /rm/print-report | Route owners mapped; detailed audit and browser checks pending |
| Sales | /sales/my-day, /sales/hub | Route owners mapped; detailed audit and browser checks pending |
| Standalone report | /rm-report/[id] | Route owner mapped; detailed audit and browser checks pending |

Total: 34 page routes. Check the admin layout and report print layout as well.

## Implementation boundaries and builder decisions

The builder may choose exact selectors, component props, local wrapper markup and responsive breakpoints based on measured fit. Preserve current styling wherever it already works. Avoid unrelated refactors. Work directly in this checkout as requested and preserve any later user edits. Do not deploy, send messages, seed or migrate the existing database.

Implementation order: complete source audit and baseline checks; shared shell/navigation; shared content controls; Admin modules; RM/report modules; Sales modules; account and standalone routes; browser defect fixes; final checks and evidence report.

## Verification and delivery

- Establish TypeScript/build baselines, then rerun after changes. Run applicable existing navigation, chart, reporting and PDF pagination tests. No lint script currently exists; report that fact rather than inventing a lint pass.
- Use the existing Playwright installation if available. Inspect existing browser harnesses before running them: some create isolated databases and synthetic fixture data. Do not seed or mutate the user's database, fabricate production metrics, or claim fixture rendering validates real data. Prefer real existing records with read-only navigation; use isolated test state only where needed to test interactions and clearly report it.
- Test major routes at 320, 375, 390, 768, 1024, 1440 and 1920px; include landscape and portrait and short viewport modal cases. Supplement with breakpoint boundary checks where defects appear.
- Check document-level overflow independently from intentional table/chart/report scrolling. Inspect content for clipping and overlap; screenshots alone do not prove functional behavior.
- Exercise drawer open/close, Escape, focus, scroll lock, navigation, filters, tabs, pagination and preview controls where available. Avoid destructive/business write actions.
- Record actual viewport sizes, screenshots inspected, automated results, route coverage, auth/data limitations and pre-existing failures. Unverified screens remain explicitly unverified.
- Deliver a concise report linking the full route/component checklist, changed files, responsive fixes, test evidence and remaining limitations. Completion requires the master prompt's full acceptance criteria; do not call the current source mapping a complete audit or a visual pass.
