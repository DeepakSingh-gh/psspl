# PSSPL CRM

Working prototype for Progressive Surface Systems.

## Local setup for a teammate

Requirements: Node.js 22 or newer and npm. The CRM uses a local SQLite file, so Supabase is not required for local development.

```bash
git clone https://github.com/Khushi-Bizgenix/psspl.git
cd psspl
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

On Windows Command Prompt, use `copy .env.example .env` instead of `cp`. Before running `db:setup`, change `CRM_ADMIN_PASSWORD` in `.env` to a private local password.

Open:

- CRM: `http://localhost:3000`
- API health: `http://127.0.0.1:4000/api/health`

Development-only salesperson credentials created by `npm run db:seed`:

```text
demo.salesperson@local.test
demo123
```

The admin email and password are read from the teammate's `.env` file.

### Database migration workflow

The database is created at `data/crm.sqlite` unless `CRM_DATABASE_PATH` is changed. Applied versions are stored in the `schema_migrations` table.

After pulling new code:

```bash
npm install
npm run db:migrate
npm run dev
```

For a schema change, create the next numbered file under `database/migrations`, for example:

```text
database/migrations/002_add_customer_category.sql
```

Commit the migration with the related application change. Never edit an already-shared migration and never place real Tally, Excel, customer or password data in a migration or seed file.

Useful commands:

```bash
npm run db:migrate   # Apply pending migrations
npm run db:status    # Confirm whether the schema is current
npm run db:seed      # Add fictional local development accounts
npm run db:setup     # Migrate and seed a new local database
```

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
