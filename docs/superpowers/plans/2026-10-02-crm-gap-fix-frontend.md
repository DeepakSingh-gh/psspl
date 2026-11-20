# PSSPL CRM Gap Fix — Frontend Plan

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Continuation of [the implementation plan](./2026-10-02-crm-gap-fix.md).

## Task 3: RM Portal — Frontend Pages

**Files:**
- Modify: `src/lib/api.ts` (add `rmApi.customers`, `rmApi.customerDetail`, `rmApi.productTrends`, `rmApi.alerts`)
- Create: `src/components/rm/rm-customers.tsx`
- Create: `src/components/rm/rm-product-trends.tsx`
- Create: `src/components/rm/rm-alerts.tsx`
- Create: `src/app/rm/customers/page.tsx`
- Create: `src/app/rm/products/page.tsx`
- Create: `src/app/rm/alerts/page.tsx`
- Modify: `src/app/rm/page.tsx` (RM home — KPI dashboard)
- Modify: `src/components/rm/rm-dashboard.tsx` (update sidebar nav)
- Modify: `src/components/rm/rm-home.tsx` (build the home KPIs)

**Interfaces:**
- Consumes: `GET /api/rm/customers`, `GET /api/rm/customers/:id`, `GET /api/rm/product-trends`, `GET /api/rm/alerts`, `GET /api/rm/dashboard`
- Produces: RM navigation with 5 items; `RmCustomers`, `RmProductTrends`, `RmAlerts` exported components

- [ ] **Step 1: Add RM API calls to `src/lib/api.ts`**

  In the `rmApi` object add:
  ```ts
  customers: (q = "", page = 0) => get<{ total: number; items: unknown[] }>(`/rm/customers?q=${encodeURIComponent(q)}&page=${page}`),
  customerDetail: (id: string) => get<unknown>(`/rm/customers/${id}`),
  productTrends: () => get<unknown>(`/rm/product-trends`),
  alerts: () => get<unknown>(`/rm/alerts`),
  ```

... (truncated to stay under 200 lines)

## Latest local follow-up ? 16 October 2026

The historical completed plan is unchanged. Subsequent local work adds a data-page Refresh Data button (excluded on login/root/print) and near-real-time Admin attendance revalidation using one shared two-second visible-tab monitor.

Clock-in/out tests used an isolated database snapshot; existing account/data records and SQL migrations were not changed. Relevant Admin tabs/filters survive automatic revalidation.

The Sales Reports October empty state is a coverage finding: last local invoice `2026-09-08`, 78 September invoices, zero for 1?16 October. No date fallback or invoice mutation was implemented.

Pending freshness code and this documentation refresh remain local; no commit, push or deployment occurred. Last verified live frontend commit: `87eae1e`.

Release context: [source synchronization and deployment status](../reports/2026-10-16-production-source-sync.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
