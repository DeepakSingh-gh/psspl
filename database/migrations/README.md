# Database migrations

Migration files are applied in filename order and recorded in the `schema_migrations` table.

- Never edit a migration after it has been shared.
- Add a new numbered SQL file for every schema change, for example `002_add_customer_category.sql`.
- Never add client, Tally, production, password or personal data to migrations.
- Test migrations against a new temporary database before committing them.

Run migrations with `npm run db:migrate`.
