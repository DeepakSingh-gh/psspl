# PSSPL CRM

Working prototype for Progressive Surface Systems.

## Signing in

| Area | Route | Who |
| --- | --- | --- |
| Salesperson workspace | `/sales/my-day` | `salesperson`, `rm` |
| Admin console | `/admin` | `admin` |

An admin account is seeded on first run (`admin@psspl.com`). Set `CRM_ADMIN_EMAIL` and
`CRM_ADMIN_PASSWORD` before the first start, or change the password from the admin console —
the built-in development password must not be used outside a local machine.

## Implemented

- Branded responsive dashboard
- Indian financial-year selector and month/quarter/year-to-date filters
- Sales, target, visit and expected-order KPIs
- Sales-versus-target visualization
- Product and territory attention alerts
- Live salesperson activity overview
- Sales team accountability table
- Searchable Customer DB with customer detail view
- Visit board for planned, active and completed visits
- Product-by-region performance heatmap
- Custom report builder and management report dialog
- Ask AI question examples and responses
- Admin-only Tally connector pairing, rotating tokens, heartbeat monitoring,
  resumable chunk uploads, sync history and normalized customer/product/sales imports
- Admin console: company overview, team performance vs target, customer and product
  masters, field-activity log, Tally source/coverage view
- Role-based access with an admin-only API surface, plus user management
  (create, edit, deactivate, reset password)

## Remaining for production

- Role-based access beyond admin/salesperson (RM-scoped views are not built yet)
- Session hardening: password policy, expiry/refresh, audit of admin actions
- Persistent database and APIs beyond the current SQLite prototype
- Mobile GPS/check-in permissions and offline synchronization
- Real customer, employee, territory, target and product masters
- Full accounting reconciliation and support for every optional Tally report
- Lead/pipeline, quotation, complaint and technical-support workflows
- Real report export, WhatsApp and email delivery
- Evidence-linked AI service
- Audit logs, notifications, data-quality rules and security hardening
