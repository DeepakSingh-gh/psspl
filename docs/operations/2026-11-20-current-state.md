# Current local CRM status - 20 November 2026

This page is the current documentation reference for the local checkout and active local SQLite database. Older plans, audits, SOPs and release records retain their dated evidence. Their descriptions of demo previews, automatic baseline initialization or seed-generated business data are superseded by this page. Local changes do not establish deployment or production acceptance.

## Database and data freshness

- The API reads SQLite, normally `data/crm.sqlite` (overridden by `CRM_DATABASE_PATH`). Supabase/Postgres is an outbound secondary mirror, not the current CRM read store.
- The installed Tally connector data-sync interval is 3,600 seconds; heartbeat is 60 seconds. Refresh Data reruns CRM loaders against the latest stored records; it does not itself fetch new Tally vouchers or guarantee second-by-second freshness.
- Supabase verification failed TLS validation with `SELF_SIGNED_CERT_IN_CHAIN`. No remote cleanup was performed and remote dummy-data counts remain unverified. Existing upsert-only mirroring does not propagate local deletions.

## Completed local dummy-data cleanup

The authorized cleanup removed nine dummy customers, 23,620 generated Excel invoice projections and 24,482 associated lines, three demo visits and one demo expected order. Nine genuine work records were preserved and relinked using unique exact-name master matches. Known fixture checks returned zero after cleanup.

All 8,294 genuine invoices, 19,198 genuine invoice lines, 2,142 non-dummy customers, 14,588 products, 13,994 payments, 156 targets, 39 users, 39 profiles and six historical datasets were preserved against the backup. These are the cleanup verification snapshot, not permanently fixed live counts. Backups and archived removed rows intentionally retain historical data.

- Verified backup: `data/crm-before-dummy-removal-2026-11-20-verified.sqlite`.
- Cleanup run: `2010695a-b09a-4d33-a76e-b122d02c5975`.
- Full evidence and limitations: [cleanup report](../uat/dummy-removal-2026-11-20/report.md).

## Setup, import and report behavior

`npm run db:setup` applies migrations only. Normal API startup never invokes webinar seeding, even if an old `CRM_ENABLE_WEBINAR_DEMO_DATA` setting exists. A missing development/test database starts empty by default. Bundled baseline restoration requires `CRM_ALLOW_BASELINE_RESTORE=true`; `CRM_DISABLE_BASELINE_RESTORE=true` overrides it. A legacy baseline can contain fixtures and must be reviewed before business use.

Seed/sample helpers require all of `NODE_ENV=test`, `CRM_FIXTURE_DATABASE=true`, an existing `CRM_TEST_DATABASE_ROOT` strictly beneath the OS temporary directory, and `CRM_DATABASE_PATH` strictly inside that root. Symlink/junction escapes and ordinary CRM database targets are refused. These tools are for disposable test fixtures only.

`npm run import:data` imports actual supplied source keys without generating invoices, field activity or accounts, resetting passwords or replacing existing ownership. Empty/partial input preserves unrelated history and targets; blank/invalid cells preserve values and supplied zero/negative values remain valid.

The active RM/Admin workspace uses the API report directly. Synthetic preview controls, sample top-five injection, invented monthly/weekly values, attendance and thrust metrics are retired. Missing evidence remains unavailable. PDF export and responsive layouts remain supported. Genuine supplied historical report snapshots remain historical source material.

## Verified local RM access

These four existing active RM accounts were checked read-only against their stored password hashes on 20 November 2026, including the latest Anil Jena and Harsh Shah credential verification. No password was reset and no account was created. This does not verify accounts on deployed environments.

| RM | Email | Local credential |
| --- | --- | --- |
| Rais Khan | `rais.khan@psspl.com` | Provided privately; omitted from public source |
| Gowri Shankar | `gowri.shankar@psspl.com` | Provided privately; omitted from public source |
| Anil Jena | `anil.jena@psspl.com` | Provided privately; omitted from public source |
| Harsh Shah | `harsh.shah@psspl.com` | Provided privately; omitted from public source |

Local login: [http://localhost:3000/login](http://localhost:3000/login), while the local frontend/API are running. Other previously documented accounts are not newly verified by this update.

## Verification and remaining work

The implementation record includes passing cleanup/import safeguards, report regressions, explicit browser/PDF tests, TypeScript and a clean production build. See the [cleanup evidence](../uat/dummy-removal-2026-11-20/report.md#verification) and [responsive audit](../uat/responsive-2026-11-20/report.md). These are recorded implementation results; this documentation update does not rerun the application test suites.

No commit, push or deployment was performed for the cleanup or this documentation update. Remote mirror cleanup and broader Tally audit findings (including company scoping and voucher lifecycle) remain outside the completed cleanup scope.

## Automatic pipeline synchronization

RM/Admin lead changes now invalidate authorized active sessions through a shared authenticated SSE stream. Admin pipeline stage counts, expected values and the recent-lead table selectively refetch without reloading the full dashboard. RM home and shared RM/salesperson LeadBoard views use the same signal. Stage changes, assignments, create/edit/delete and visit-generated leads participate through transactional SQLite triggers (migrations 017/018).

The server checks committed owner revisions every 500 ms while streams are active. It sends only scoped revision hashes and rechecks session validity/team access. Clients reconnect automatically, reload after reconnect/focus/online, coalesce background reads, retry transient read failures and fall back to targeted reads when streaming is unavailable. Existing single-database/role/team boundaries apply; this does not add multi-tenant company identity or change the Tally connector's hourly schedule. See [implementation and verification](../uat/pipeline-sync-2026-11-20/report.md).

## RM check-in location audit and fixes

Original attendance coordinates, accuracy and capture timestamps are now stored/displayed independently of later movement. Click-only high-accuracy capture handles permissions/timeouts and explicit coarse/no-GPS choices. Historical rows are preserved without guessed accuracy/address backfills. Admin map links use exact coordinates and existing attendance revision monitoring detects address changes. The user selected self-hosted Nominatim support with endpoint configuration deferred; no employee coordinates are sent to public Nominatim. See [operations](check-in-location.md) and [verification report](../uat/check-in-location-2026-11-20/report.md). Automated GPS/geocoder tests use mocks; real-device field verification remains manual.

## Latest phone verification and access documentation

The latest requested RM logins are Anil Jena (`anil.jena@psspl.com`) and Harsh Shah (`harsh.shah@psspl.com`), both already active; their verified local credentials were supplied privately in the conversation. Rais Khan and Gowri Shankar remain verified local accounts. This credential check created no account and reset no password; deployed accounts are not verified by these local checks.

The phone screenshot used plain HTTP on the LAN. The UI now distinguishes Checked Out from Checked In, displays successful attendance saves as informational messages, guards duplicate checkout clicks and states when no GPS check-in was recorded. Insecure origins receive explicit HTTPS guidance. Trusted HTTPS on the physical phone remains unconfigured, separate from the agreed deferred self-hosted Nominatim endpoint. See [phone access and checkout notes](check-in-location.md#phone-screenshot-follow-up-http-lan-access-and-checkout-state).

Recorded follow-up verification: 12 unit tests and the extended mocked desktop/mobile browser scenario passed; TypeScript and the production build passed. These are implementation results, not new test execution by this documentation-only update. Real-device GPS success and actual self-hosted address resolution have not been verified. No production deployment is established.
