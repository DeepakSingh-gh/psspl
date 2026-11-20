# Universal Responsive CRM Implementation Plan

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make every existing CRM route usable across mobile, tablet and desktop while preserving existing behavior and branding.

**Architecture:** Extend existing CSS and role shells. Share drawer interaction behavior; retain role-owned navigation and authorization. Keep complex content in bounded local scroll regions and isolate screen changes from print/export canvases.

**Tech Stack:** Next.js 15, React 19, TypeScript, existing CSS, Playwright.

**Spec:** docs/superpowers/specs/2026-11-20-universal-responsive-design.md (approved 20 November 2026).

## Global Constraints

- Work directly in the existing checkout as requested; retain all pre-existing work.
- Preserve desktop identity, business behavior, routes and printable/export formatting.
- No dependencies, production data writes, API changes, schema changes or deployment.
- Browser evidence uses an isolated copy of existing data; no new application demo records.
- Record actual test coverage and limitations. No configured lint command exists.

## Review Focus

- Drawer resize to desktop must release scroll locking and preserve sidebar accessibility.
- Closing a drawer must restore focus; hidden links must not remain keyboard reachable.
- Long text, dates and currency must fit without page-level overflow at 320px.
- Wide PDF canvases must remain reachable from their left edge without changing exported dimensions.
- Short landscape viewports must retain reachable modal close and action controls.

### Task 1: Browser baseline and route audit

**Files:** Create scripts/responsive-audit.mjs and docs/uat/responsive-2026-11-20 evidence; inspect all src/app page owners and all component/CSS files.
**Interfaces:** Produces a repeatable browser runner using a temporary app copy, existing database snapshot and role sessions; never loads .env into API process.
- [x] Inventory all routes and component overflow/width rules; record baseline TypeScript result.
- [x] Run browser baseline for Admin, RM and Sales navigation at 390px; assert drawer open/close, Escape, focus, scroll lock and desktop resize behavior; capture expected failures before implementation.
- [x] Record all route content states and real-data/auth limitations.

### Task 2: Shared mobile navigation

**Files:** Create src/components/common/mobile-navigation.tsx; modify admin-shell.tsx, rm-shell.tsx, rm-dashboard.tsx, sales-sidebar.tsx; add navigation styles in src/app/responsive.css and import from root layout.
**Interfaces:** useMobileNavigation returns open state, toggle/close handlers and refs for opener/drawer; accepts stable route identity and breakpoint. MobileNavigationControls provides consistent labelled controls and backdrop.
- [x] Implement minimal shared focus, Escape, background inertness and scroll locking, closed drawer inertness and desktop resize cleanup.
- [x] Wire all actual role shells, including the independently rendered RM team shell, preserving existing navigation items.
- [x] Run browser navigation assertions again; expect all tested shell cases to pass.

### Task 3: Responsive route and component fixes

**Files:** Modify existing owning styles/components as evidence requires; shared screen-only fixes in src/app/responsive.css; source edits for inflexible inline forms in sales-workspace.tsx and lead-board.tsx; report viewport styles in reports/rm-performance.css if needed.
**Interfaces:** Retains all current component public props and business handlers.
- [x] Review each route owner, tabs, forms, tables, charts, detail drawers and report preview; record source coverage.
- [x] Measure all major routes at widths 320,375,390,768,1024,1440,1920 and representative landscape/portrait heights; record actual overflowing elements, including overflow masked by existing clipping.
- [x] Fix shrinking/wrapping, locally scrollable tables/charts, touch controls, constrained modals, PDF panning and screen-only standalone print previews.
- [x] Repeat failing viewport cases and inspect representative screenshots; retain full printable dimensions.

### Task 4: Verification, review and delivery

**Files:** Final evidence/report and updated route checklist.
- [x] Run TypeScript, production build, applicable pure chart/report/PDF tests and the browser audit; record every failure and its pre-existing status if established.
- [x] Request an independent whole-change review per executing-plans; address material findings and verify fixes.
- [x] Write final route/component coverage, changed-file list, viewport evidence and limitations. Keep changes local and reviewable without merging, publishing or deploying.

## Execution record

The user approved the design and instructed proceeding with implementation. Execute this plan continuously in place. Developer instruction to avoid redundant approval requests takes precedence over the skill's additional plan handoff gate. Use a persistent progress document; retain uncommitted changes for user review.
