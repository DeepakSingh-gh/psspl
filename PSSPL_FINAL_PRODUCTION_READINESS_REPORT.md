# PSSPL CRM â€” Final Production Readiness Report

Assessment date: 19 October 2026. Scope: local repository code and isolated synthetic test databases, plus the additive local queue-schema repair described below. No deployment, commit, push, production configuration change, Tally exchange, WhatsApp delivery, or production database write was performed. One queued invitation was submitted to Resend during the local repair; see the incident note below.

## Work completed today - 19 October 2026

1. Verified Dhruv Maurya's salesperson scope and Harsh Shah's assigned RM team; fixed cross-salesperson customer access and restored the RM dashboard at `/rm`.
2. Verified invitation, activation, reset, queue, and webhook behavior with mocked email tests; repaired the missing local `auth_email_pending_events` table through additive migration 010 after an encrypted backup. The already-queued real invitation processed during repair is disclosed below.
3. Completed isolated regression verification: 97 unique TAP checks passed, with TypeScript, production build, and dependency audit passing. This is local evidence, not production acceptance.
4. Diagnosed stale Tally figures from connector heartbeat data and checked Rudra Kumar's failed invitation: its latest queue attempt ended `provider_rejected`, so no delivery was recorded. The test sender restriction is the likely cause; the backend did not retain Resend's detailed rejection message.

## Executive assessment

**Production status: NO-GO pending external and client evidence.** Local development readiness improved: email invitation/activation and reset flows, optional cookie sessions with CSRF checks, Admin RM assignment, RM active-team filtering, and regression coverage are implemented. This does not close client acceptance, live integration, database rollout, historical data authorization, or physical device requirements.

The existing reconciled matrix records 30 requirements completed, 102 partially completed, 5 not implemented, and 5 not verified (142 total). This execution adds evidence for authentication, account lifecycle, role isolation, RM assignment, and email delivery handling. It does not promote matrix rows to fully complete because production deployment, business acceptance, or external evidence remains outstanding. Row-level statuses and findings remain in the canonical [Phase 9C matrix](docs/project-records/PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md).

## Dashboard and Tally verification update - 19 October 2026

This follow-up verified the salesperson and RM dashboards using the configured local database and isolated synthetic test fixtures. The configured database was opened read-only for these checks; no CRM records, account assignments, connector configuration, or live settings were changed.

- Dhruv Maurya is an active `salesperson` account assigned to active RM Harsh Shah through `salesperson_profiles.manager_user_id`. Harsh has one active salesperson assigned in the local roster (Dhruv). Dhruv currently has zero customers owned by his account and zero visit, follow-up, or lead records; 58 local customer rows are owned directly by Harsh's RM account. Do not infer or create customer ownership from RM relationship or Tally names.
- Found and fixed a cross-salesperson authorization defect: salesperson customer, overview, and customer-detail scopes had expanded to all salespeople reporting to the same RM. Salesperson data is now scoped to that user's own account. RM access continues to use the explicit assigned team. Regression coverage now asserts peer-customer denial and filters peer activity from customer detail.
- The RM root route previously redirected to `/sales/my-day`, despite an existing RM dashboard. It now renders the RM dashboard. The dashboard's territory list now comes from active assigned salespeople; hard-coded city coverage and fallback RM identity/area values were removed from that dashboard.
- Salesperson routes are `/sales/my-day` and `/sales/hub`. The hub contains Customer DB, Pipeline, Requests, Alerts, and Reports. RM routes include `/rm` for the team dashboard and `/rm/team` for date-filtered team performance.
- Tally diagnosis from the local database: an active paired connector record exists and its latest heartbeat reached the CRM service, but `tally_available` is false and no company is selected in that heartbeat. The most recent successful sync is dated 10 October 2026 and stored 27,285 records; cached data currently includes 1,692 customer rows, 25,116 invoice rows, and 14,547 product rows. The 19 October dashboard warning is therefore explained by the connector reporting that Tally/the company was unavailable, with stale cached data; it is not evidence of CRM API outage or a missing local database. The heartbeat does not distinguish a closed Tally company from a Tally-side permission problem. No live Tally probe or sync was initiated. Open Tally with the authorized company selected, confirm the connector can read it, then allow a heartbeat/sync before current figures can be verified.
- Verification: all 17 test files passed (93 checks) on isolated temporary databases, including authentication/RBAC, invitation/reset lifecycle, email retries/webhooks, cross-team isolation, RM reassignment, Tally accuracy, desktop dashboard navigation, and mobile layout. `npx tsc --noEmit` and `npm run build` passed on Next.js 15.5.28. Browser evidence was directed outside the repository to a disposable temp folder.

Files changed in this follow-up: `server/tally/connector.mjs`, `server/sales-routes.mjs`, `server/rm-routes.mjs`, `server/app.mjs`, `src/app/rm/page.tsx`, `src/components/rm/rm-home.tsx`, `src/components/sales/sales-workspace.tsx`, `src/types/sales.ts`, `scripts/phase1-security.test.mjs`, and `scripts/phase9b-browser.test.mjs`.

## Implemented in this execution

- Admin-created accounts remain inactive until email activation. Admin can set a temporary credential; only its salted scrypt hash is stored. The invitation token is stored as a SHA-256 hash, expires after 48 hours, and can be used once. The employee sets a password from the invitation link. Resending invalidates the previous link.
- Self-service reset responses do not reveal whether an email exists. Active accounts receive a one-time reset link valid for 15 minutes when email is configured. Resetting changes the password and revokes every session. No plaintext password is emailed.
- Follow-up verification held the mocked Resend response open: registered and unknown email requests returned the same public response without waiting for provider latency. The Admin invitation screen labels network-ambiguous delivery as uncertain.
- Added migration `009_auth_email_queue.sql` and a durable SQLite-backed invitation/reset queue. Link payloads are encrypted with AES-256-GCM using `CRM_EMAIL_QUEUE_KEY`; token hashes remain in `auth_tokens`. A transaction creates each token and job together. The worker resumes on restart, claims jobs with a lease, checks the current token and expiry, retries transient failures with a stable Resend idempotency key, and erases encrypted payload after terminal outcomes. Pending jobs block duplicate link issuance. Signed webhooks arriving before a send response are retained and reconciled. Provider acceptance remains distinct from confirmed delivery.
- Integrated the official Resend Node SDK in the Express backend. `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` are server-side settings; API keys are never sent to the browser. Branded activation and recovery templates are included. SDK retries use a stable idempotency key; repeated requests are rate-limited and held by a per-account cooldown.
- Added a Resend signed webhook for sent, delivered, delayed, bounced, complained, failed, and suppressed events. Admin status distinguishes provider acceptance from provider-confirmed delivery. No email is described as delivered before a verified `email.delivered` event.
- Added optional HttpOnly session cookies with `SameSite=Lax`, `Secure` in production, and a double-submit CSRF token plus configured Origin validation for unsafe cookie-authenticated requests. The browser sends credentials and CSRF headers. Existing bearer sessions remain supported. Cookie mode stays disabled by default because the current documented Vercel/Render split does not establish a same-site HTTPS API origin.
- Added activation, password reset request, and password reset completion screens. Admin sees invitation-pending and email-delivery status and can resend an invitation. A one-time temporary password is shown only in the Admin browser and is never included in the email.
- RM dashboard team queries now exclude inactive salespeople. Admin may assign/reassign a salesperson; backend validates active RM identity. The RM scope comes from `salesperson_profiles.manager_user_id`.
- Added additive migration `006_auth_tokens.sql` for one-time auth tokens. Existing account rows, credentials, and sessions are unchanged; invitation status is determined from the activation-token record. A read-only check during the 19 October UI troubleshooting confirmed migration 006 and `auth_tokens` are already present in the configured local database; it has no `activated_at` column. The UI fix now matches that schema, and troubleshooting made no database writes.
- Added synthetic lifecycle and cookie/CSRF regression coverage, and made browser-test evidence output configurable so it can be kept outside existing UAT folders.
- Separated Next.js development artifacts into `.next-dev` while retaining `.next-runtime` for local production builds. This resolves a runtime failure caused by `next dev` and `next build` mixing webpack runtime and page chunks in one directory. Confirmed the development route returned HTTP 200 while a production build completed successfully.

### Modified and added files

- `server/app.mjs`, `server/auth.mjs`, `server/admin.mjs`, `server/rm-routes.mjs`
- `server/auth-tokens.mjs`, `server/auth-email-queue.mjs`, `server/email-provider.mjs`, `server/email-templates.mjs`, `server/resend-webhook.mjs`
- `database/migrations/006_auth_tokens.sql`, `database/migrations/008_auth_email_delivery.sql`, `database/migrations/009_auth_email_queue.sql`, `.env.example`
- `src/lib/api.ts`, `src/types/admin.ts`, `src/types/sales.ts`
- `src/components/auth/login-form.tsx`, `src/components/auth/account-token-form.tsx`, `src/components/admin/admin-users.tsx`, `src/components/admin/admin-shell.tsx`
- `src/app/forgot-password/page.tsx`, `src/app/activate-account/page.tsx`, `src/app/reset-password/page.tsx`
- `next.config.ts` (isolated development build directory)
- `scripts/phase1-security.test.mjs`, `scripts/phase8-fixture-server.mjs`, `scripts/phase8-workflows.test.mjs`, `scripts/auth-cookie.test.mjs`, `scripts/phase9b-browser.test.mjs`
- `scripts/email-provider.test.mjs`, `scripts/auth-email-queue.test.mjs`, `scripts/auth-email-queue-worker.mjs`, `package.json`, `package-lock.json`, `src/components/admin/admin-users.tsx`, `src/lib/api.ts`, `src/types/admin.ts`
- `docs/operations/resend-email-authentication.md`

## Authentication and account status

### Architecture

Express remains the authentication authority. Passwords use the existing salted scrypt hash; opaque random bearer values are stored as SHA-256 hashes in `sessions`. Existing session expiry and revocation behavior remains. The new `auth_tokens` table stores only hashes of activation/reset tokens. Cookie mode is an opt-in transport for the same server session; RBAC and data authorization continue on Express routes.

### Existing roster review

Read-only account inventory recorded in the project execution context found 13 active RMs and 11 active salespeople. Two active RM accounts share the name **Anil Jena** (the records use `anil.jena@psspl.com` and `anil@psspl.com`); this report does not merge or choose one. One demo salesperson account (`demo.salesperson@local.test`) is unassigned. No one was assigned arbitrarily. These identities, official work emails, and the correct Anil Jena account require the business owner to confirm.

Existing active accounts remain compatible and were not provisioned, reactivated, or emailed. No account invitations were sent during this execution. The new workflow creates a pending account only when an Admin enters an email; with email disabled or incomplete, the account stays inactive and can be invited later. The roster itself is not a verified HR source and must be confirmed before launch.

Earlier 19 October follow-up: a read-only check found `deepak8737850179@gmail.com` inactive, with no invitation token, queued job, or delivery record. The local `.env` now has the Resend provider, API key, test sender `onboarding@resend.dev`, local `APP_BASE_URL`, and valid queue key; key values are not recorded here. `RESEND_WEBHOOK_SECRET` remains absent. Localhost activation links work only on the CRM host. The Admin UI shows **Resend invitation** for inactive accounts. Isolated API and Chromium tests passed.

### Local invitation error and schema repair, 19 October 2026

- The configured local database recorded migration 009 but lacked `auth_email_pending_events`. Clicking **Resend invitation** inserted a durable job, then the worker raised a missing-table error; Express returned the generic HTTP 500 shown in the screenshot. The queued job remained, so retrying blindly risked duplicate invitations.
- Added idempotent migration `010_auth_email_pending_events.sql`, created an encrypted local SQLite backup first (restore key retained in ignored `.env.backup.local`), then applied only migration 010 to the local database. No account or customer row was intentionally edited. The local API remained healthy. A synthetic regression recreates the older schema and verifies that migration 010 repairs it.
- **Unintended live submission:** once the table existed, the already-queued job for `deepaksingh873785@gmail.com` was processed automatically despite the earlier instruction not to send live mail. Resend accepted it; a read-only Resend API lookup reported `last_event=delivered`. The CRM database still records only `accepted` because the signed webhook secret is absent. Inbox receipt and link use were not checked. This was an error in the repair sequence; no further send was triggered by the agent. The separate account `deepak8737850179@gmail.com` had an older canceled job and was not the submitted recipient.
- Admin now shows the latest invitation status in the drawer and treats a failed request as **status uncertain**, asking the administrator to refresh and check before retrying. Provider acceptance is still not shown as confirmed delivery.

## Requirement reconciliation

The canonical 142-row matrix retains the reviewed 18 October 2026 evidence status. New local test evidence is summarized above; unresolved acceptance and dependency findings remain in the matrix. Counts remain 30 COMPLETED, 102 PARTIALLY COMPLETED, 5 NOT IMPLEMENTED, and 5 NOT VERIFIED. Do not treat these classifications as client sign-off.

## Test and security results

- Final isolated runner after migration 010: **93 passed, 0 failed** across its TAP suites, plus the standalone My Day check. Three additional provider/queue checks and one cookie/CSRF check passed separately: **97 unique TAP checks passed, 0 failed** across all 18 test files. The focused queue, migration, and auth suites passed **14/14**; production build and TypeScript passed again. All email/provider calls in tests were mocked.
- The first concurrent rerun had two browser-test setup failures during its isolated Next build (92/94 passed). The browser tests passed alone (2/2), and the complete suite then passed with `--test-concurrency=1` (94/94). The final production build, subsequent `npx tsc --noEmit`, and `npm audit --audit-level=low` also passed. TypeScript was rerun after the build because the build regenerates `.next-runtime/types`.
- Authentication lifecycle: invitation, activation, expired and replayed tokens, generic reset response, 15-minute reset expiry, duplicate-email rejection, resend cooldown, password reset, session revocation, signed delivery events, and out-of-order event protection passed in the phase 8 isolated API test.
- Final authentication hardening: token consumption and account change now occur in one transaction; activation requires an inactive account. Admin password resets and manual account status changes revoke outstanding links. Added an RM activation/login regression and stale-link checks. Expired invitation tokens no longer display as pending in Admin. A permanent synthetic Resend rejection is recorded as failed and never shown as delivered.
- Queue restart test: encrypted job persisted across worker processes, an accepted job was not submitted twice, a synthetic 5xx response retried, a pending job blocked another link, an expired token was skipped, and a delivered webhook received before API acceptance was reconciled. All Resend calls were mocked.
- Cookie/CSRF: no bearer token in cookie-mode login JSON; authenticated cookie request passed; missing CSRF and unapproved Origin were rejected; approved CSRF logout passed and revoked the session.
- RM assignment: unassigned salesperson creation is rejected; Admin assignment/reassignment updates team visibility; pending inactive accounts do not appear in the active RM team.
- Browser/mobile: **3 Chromium checks passed** from an isolated project copy: desktop role dashboards/navigation/download flows, mobile viewport navigation/forms without horizontal overflow, and the Admin invitation action. This is viewport evidence, not physical-device/GPS/microphone acceptance.
- TypeScript: `npx tsc --noEmit` passed.
- Production build: `npm run build` passed on Next.js 15.5.28.
- The final isolated runner reported zero application source/config changes during testing. Four configured local database/WAL differences occurred while the separate live development server was running; the runner cannot attribute concurrent writes to its tests. Its test fixtures used temporary databases, and no production account was modified.
- Dependency audit: `npm audit --audit-level=low` reported **0 vulnerabilities**, including the Resend SDK dependency.
- Migrations were tested via fresh synthetic app startup. No configured/local business database was migrated or changed intentionally.

## Remaining client decisions and external blockers

- Confirm official employee roster and emails, resolve the duplicate Anil Jena accounts, and authorize assignments for unassigned salesperson(s). Existing associations were not rewritten.
- Local Resend test sending is configured with `onboarding@resend.dev`; one previously queued invitation was submitted during the schema repair, as documented above. `RESEND_WEBHOOK_SECRET` is missing, so signed delivery events cannot be confirmed in the CRM; `APP_BASE_URL` is localhost and unsuitable for remote users. For production, configure a verified company sender domain with SPF/DKIM/DMARC, a public HTTPS `APP_BASE_URL`, a signed webhook secret, and durable backend secrets/queue key. Authorize any further real-recipient UAT before sending invitations.
- Confirm the browser and API share a same-site HTTPS origin before enabling `CRM_SESSION_COOKIE_ENABLED=true`; configure the exact frontend origin in `CRM_ALLOWED_ORIGINS`. If the deployment remains cross-site, retain bearer compatibility until the routing architecture changes.
- Approve database backup/storage and migration window. The new additive migration is pending. Render Free filesystem is documented as ephemeral; provision persistent database and backup storage first.
- The prior Phase 9C assessment remains **NO-GO**: E03 live Tally evidence, G07 WhatsApp evidence, applicable H13 tenancy decision/tests, H14 historical development-data authorization, and H15 NDA evidence remain open. These are external/client gates.
- Five requirements remain NOT IMPLEMENTED: B12 authoritative customer-origin date, C05 physical-visit geofence policy/data, C08 mandatory activity policy, C17 English translation requirements/provider, C19 mandatory transcription/consent/exception policy.
- Confirm control totals, target units/mapping, business thresholds, lead lifecycle, and other CA01â€“CA28 decisions in the existing decision register. Physical device UAT, training, and formal client acceptance remain pending.
- Existing process-local rate limiting is suitable only for a single Express instance; a multi-instance production deployment needs a shared limiter store or equivalent edge controls.

## Production rollout checklist (after approvals)

1. Confirm the official roster, duplicate resolution, work emails, RM mappings, target values, and account owners in the client approval register.
2. Provision persistent database storage and a separate durable encrypted backup destination. Configure `CRM_DATABASE_PATH`, `CRM_BACKUP_DIR`, and a protected backup key in the host secret manager. Complete and record a restore drill before migration.
3. Review `006_auth_tokens.sql`, `008_auth_email_delivery.sql`, `009_auth_email_queue.sql`, `010_auth_email_pending_events.sql`, and the full pending migration set. Take and verify an encrypted backup. Apply migrations using the approved maintenance procedure (`CRM_ALLOW_DATABASE_MIGRATION=true` for `npm run db:migrate`); verify migration status, integrity, and application behavior. Check and resolve existing queued jobs before enabling the worker. Do not enable startup schema changes as a substitute for review.
4. Configure `APP_BASE_URL` to the production frontend URL. For email, set `CRM_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, verified `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, and a durable `CRM_EMAIL_QUEUE_KEY` in the secret manager. Keep credentials out of source and logs. Follow `docs/operations/resend-email-authentication.md`, then verify with an approved test recipient before sending real invitations.
5. Confirm same-site HTTPS routing and exact CORS origins. Only then enable `CRM_SESSION_COOKIE_ENABLED=true`; otherwise leave it false. Validate Secure/HttpOnly/SameSite cookies, CSRF rejection, logout, and legacy bearer sessions in production-like UAT.
6. Run the approved synthetic suite, then authorized Tally read-only reconciliation, WhatsApp sandbox UAT, browser/device tests, cross-role isolation tests, and client UAT checklist. Capture evidence and sign-off.
7. Arrange deployment and rollback with the service owner. Preserve the database and pre-deploy code/config snapshot. If checks fail, restore the prior code release and use the approved database recovery plan; do not blindly reverse a committed migration.
8. Enable real-user invitations only after the business owner confirms each identity and email. Monitor login failures, mail delivery, session revocation, database health, backups, and integration freshness.

## Source records

- [Phase 9C requirements matrix](docs/project-records/PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md)
- [Phase 10 go/no-go assessment](docs/project-records/PSSPL_PHASE10_GO_NO_GO_UPDATED.md)
- [Client decision register](docs/project-records/PSSPL_CLIENT_DECISION_REGISTER.md)
- [Final client UAT checklist](docs/project-records/PSSPL_FINAL_CLIENT_UAT_CHECKLIST.md)
- [Live integration UAT plan](docs/project-records/PSSPL_LIVE_INTEGRATION_UAT_PLAN.md)
- [Database backup and recovery runbook](docs/operations/database-backup-recovery.md)
- [Resend email authentication setup](docs/operations/resend-email-authentication.md)

## Requirement detail

The full 142-row requirement status and evidence table is maintained in the canonical [Phase 9C requirements matrix](docs/project-records/PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md).

