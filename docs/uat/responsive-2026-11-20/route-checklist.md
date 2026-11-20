# Responsive route/source checklist

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

All 34 page route owners were mapped. The final browser results distinguish loaded content, intentional redirects, missing-token account states, errors and incomplete loading. Dynamic report routes use a real RM key from the API catalog.

| Route | Source | Content owner |
| --- | --- | --- |
| `/activate-account` | `src/app/activate-account/page.tsx` | AccountTokenForm |
| `/admin/activity` | `src/app/admin/activity/page.tsx` | AdminActivity |
| `/admin/alerts` | `src/app/admin/alerts/page.tsx` | AdminActivity |
| `/admin/archived-employees` | `src/app/admin/archived-employees/page.tsx` | AdminArchivedEmployees |
| `/admin/ask-ai` | `src/app/admin/ask-ai/page.tsx` | AdminAskAi |
| `/admin/audit` | `src/app/admin/audit/page.tsx` | AdminAudit |
| `/admin/customers` | `src/app/admin/customers/page.tsx` | AdminCustomers |
| `/admin/management-reports` | `src/app/admin/management-reports/page.tsx` | AdminManagementReports |
| `/admin` | `src/app/admin/page.tsx` | AdminOverview |
| `/admin/products` | `src/app/admin/products/page.tsx` | AdminProducts |
| `/admin/reports` | `src/app/admin/reports/page.tsx` | AdminReports |
| `/admin/rm-feedback` | `src/app/admin/rm-feedback/page.tsx` | AdminRmFeedback |
| `/admin/tally` | `src/app/admin/tally/page.tsx` | AdminTally |
| `/admin/team/[id]` | `src/app/admin/team/[id]/page.tsx` | AdminRmDetail |
| `/admin/team/[id]/print` | `src/app/admin/team/[id]/print/page.tsx` | route-owned screen |
| `/admin/team` | `src/app/admin/team/page.tsx` | AdminTeam |
| `/admin/team-structure` | `src/app/admin/team-structure/page.tsx` | AdminTeamStructure |
| `/admin/trends` | `src/app/admin/trends/page.tsx` | AdminProductTrends |
| `/admin/users` | `src/app/admin/users/page.tsx` | AdminUsers |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | route-owned screen |
| `/login` | `src/app/login/page.tsx` | LoginForm |
| `/` | `src/app/page.tsx` | redirect |
| `/profile` | `src/app/profile/page.tsx` | route-owned screen |
| `/reset-password` | `src/app/reset-password/page.tsx` | AccountTokenForm |
| `/rm/alerts` | `src/app/rm/alerts/page.tsx` | RmShell, RmAlerts |
| `/rm/customers` | `src/app/rm/customers/page.tsx` | RmShell, RmCustomers |
| `/rm` | `src/app/rm/page.tsx` | redirect |
| `/rm/print-report` | `src/app/rm/print-report/page.tsx` | route-owned screen |
| `/rm/products` | `src/app/rm/products/page.tsx` | RmShell, RmProductTrends |
| `/rm/report-card` | `src/app/rm/report-card/page.tsx` | RmReportCard |
| `/rm/team` | `src/app/rm/team/page.tsx` | RmDashboard |
| `/rm-report/[id]` | `src/app/rm-report/[id]/page.tsx` | route-owned screen |
| `/sales/hub` | `src/app/sales/hub/page.tsx` | SalesHub |
| `/sales/my-day` | `src/app/sales/my-day/page.tsx` | SalesWorkspace |

## Shared surfaces reviewed

- Admin shell/topbar/page grids/KPI tiles and both RM shell implementations; Sales rail shared by My Day and Customer DB.
- Admin Overview, Team Performance and RM detail/report workspace; Product/Customer intelligence and detail drawers; Product Trends chart/tooltip; Activity and Alerts; Users and account dialogs; Archived Employees; Team Structure; Tally; Audit; Sales Reports and all grouping options; Management Reports and all five views; supplied RM feedback.
- RM Customers and inline dormant-dealer reason form, Product Trends, Alerts, Team Performance and performance/attendance/report-card views.
- Sales My Day forms, visit and follow-up modals; Customer DB, Pipeline and lead form, Requests, Alerts and Reports tabs. Unused legacy RequestForm was reviewed and its intrinsic column sizing corrected without making it reachable or adding a feature.
- Standalone RM reports and feedback print schedule; both current and legacy PDF preview viewports; fixed report canvases and pagination. Print/export canvas dimensions and generation handlers retain their existing implementations.
- Login, recovery, activation, reset and profile layouts; root and RM landing redirects. Token-missing states are covered; no account links are issued by this audit.

## Evidence interpretation

`results.json` records the actual route, loaded headings, readiness status, seven viewport measurements and the 844x390 landscape measurement per route. `interactions.json` records exercised view names and modal checks. Screenshots alone are not a proof of functional correctness. Representative screenshots were inspected separately; automated measurement of every route is not described as manual visual inspection of every screenshot.
