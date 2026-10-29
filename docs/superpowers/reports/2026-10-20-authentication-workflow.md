# Authentication workflow implementation report

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

## 21 October follow-up: employee credential emails and restoration

The current flow supersedes the original no-password-email behavior in the dated implementation below. **Create user & Send Email** explicitly sends the admin-entered password and all saved employee fields in a professional HTML/plain-text email. **Manage > Account email** can include a re-entered current password after hash verification; existing passwords are never retrieved from the database. Responses/audits exclude passwords and tokens, queued templates remain encrypted, and changed-password jobs are canceled before sending.

Gmail SMTP is configurable alongside the preserved Resend provider. The local Gmail connection/authentication succeeded. Earlier explicitly authorized notices were accepted and the user supplied an inbox screenshot; those notices did not include passwords. No real password-bearing email was sent while implementing the new template. SMTP provider acceptance is not independent delivery confirmation. Migration 013 pins providers and migration 014 preserves queue/delivery records while adding token-free account notices. Account details can be sent without unusable localhost links; remote CRM login/recovery still requires a reachable URL and matching database.

Latest scoped validation: 12 authentication tests passed with each mocked provider, professional template tests (2), SMTP queue credential-version checks, provider/restart checks, browser/mobile verification and production build passed in their recorded runs. No tests were rerun by the documentation refresh. See the [current email guide](../../operations/gmail-smtp-authentication.md) for exact behavior, field list, APIs and reproduction commands.

Archived employees now have **Restore employee**, which assigns new credentials to the retained identity without rewriting CRM history. The earlier archive-only follow-up below describes the initial read-only implementation.

## Original implementation record - 20 October 2026

Date: 20 October 2026 (Asia/Kolkata).

Status: implemented and validated locally. No production database changes, deployment, real email delivery, or GitHub push were performed for this implementation.

21 October archive follow-up: admin can browse deleted accounts and their preserved history from **Archived employees** (`/admin/archived-employees`). The view reuses the retained identities from account deletion and adds paginated, admin-only read APIs. See [Archived employees](../../operations/archived-employees.md) for sections and scope. This page implementation does not mutate employee or CRM records; the separately requested local bulk account deletion is recorded in its local operation report.

21 October email sign-in follow-up: the browser explicitly sends work emails in the `email` request field and Login IDs in `loginId`, preserving the email contract for older API versions. Identifiers are trimmed and email addresses lowercased; passwords are not modified. API regression checks verify that Login ID, email and the older email-in-`loginId` format resolve to the same account, including mixed case and surrounding spaces. Existing account email addresses and passwords were not changed.

Navigation correction: the Admin avatar/account shortcut opens `/admin/users` for employee credential management. A separate **My profile** link opens the administrator's own profile. Profile includes **Manage employee accounts** and **Back to admin dashboard** links; its own password form is collapsed under **Change my password** and is explicitly optional. Profile controls use their own styles so inputs and the submit button do not depend on login-page CSS variables.

Account deletion follow-up: **Delete** beside Manage opens an email-confirmation dialog. As requested, this removes the sign-in account while preserving CRM history. Migration 012 adds `deleted_at`; deleted accounts are inactive, hidden from the user list and unavailable for reset, invitation or reactivation. Password hashes, Login IDs and original sign-in email are removed; sessions and tokens are revoked, queued auth payloads erased, recipient report schedules disabled and unused pairing codes revoked. The user/profile reference, historical name, employee code and CRM records remain for attribution. Customer ownership is retained and may be reassigned through Customers. Reporting employees must be reassigned before deleting their RM, and the current administrator cannot delete themselves. No real account or production data was deleted during implementation/testing.

## Changes

| Area | Implemented behavior |
| --- | --- |
| Admin account creation | Requires Login ID, email, role and an initial password of 12 to 200 characters. New accounts are active immediately; no mandatory first-login setup or automatic invitation. Salesperson creation still requires a valid active RM assignment. |
| Login | Accepts case-insensitive Login ID or email. Older clients using the `email` request field and existing accounts without Login IDs remain supported. Existing role-based landing areas are retained. |
| Voluntary password changes | Profile links are available in the Admin, RM and Salesperson workspaces. `/profile` contains Security with current password, new password and confirmation fields. Both client and API validate confirmation. |
| Forgot Password | Reuses the existing Resend SDK, templates, encrypted durable queue and signed delivery webhook. Reset links contain random tokens, expire after 15 minutes and are single-use. Known and unknown accounts receive the same public response. |
| Admin password reset | Admin can replace passwords without retrieving existing ones. The reset does not change account status, roles, reporting lines or CRM records. Inputs are masked. |
| Hashes and sessions | Retains salted scrypt password hashes and SHA-256 session/token digests. Password changes, resets and legacy activation revoke all target-account sessions and tokens in the same database transaction. Queued or processing account emails have their encrypted payload erased and are canceled. The current session is also revoked. |
| Concurrency | Password change uses a conditional update against the verified hash and live session. Login checks the account/hash again after asynchronous verification before issuing a session. Concurrent use of a reset link succeeds once. |
| Audit privacy | Redacts password, token, credential, secret and pairing-code fields, including nested objects. Initial passwords are no longer left in audit details or displayed in a post-creation credential banner. Passwords are absent from API responses and email templates. |
| Legacy invitations | Existing inactive accounts and pending activation links remain supported. Admin must explicitly request invitation/resend delivery. New account creation no longer queues invitations. |
| Database | Additive migration 011 adds nullable `users.login_id` and a case-insensitive unique index. Existing rows receive no generated IDs, password resets, role changes or activation changes. |

Login IDs contain 3 to 64 letters, numbers, dots, underscores or hyphens and begin with a letter or number. Creation normalizes them to lowercase. Keeping `@` out of Login IDs prevents ambiguity with email addresses. Login IDs are shown/searchable in the admin account list.

## Main files

- `server/app.mjs`: compatible Login ID login, authenticated password-change endpoint, stale-password login protection, reset/activation revocation.
- `server/auth.mjs`: shared account-access revocation and safe session user projection.
- `server/admin.mjs`: immediate account creation, Login ID validation, password reset revocation and audit redaction.
- `database/migrations/011_user_login_id.sql`: additive schema change.
- `src/app/profile/page.tsx`: voluntary Security password form and explicit sign-in after all sessions are revoked.
- `src/components/admin/admin-users.tsx`: initial-password creation flow, Login ID field and masked admin reset.
- `src/components/auth/login-form.tsx`, `src/lib/api.ts`, `src/types/admin.ts`: login and password-change client contracts.
- Admin, RM and salesperson navigation components: Profile entry points.
- `scripts/auth-workflow.test.mjs`, `scripts/auth-cookie.test.mjs`: new authentication coverage.
- Existing authorization, workflow and browser suites: updated expectations for immediate activation; legacy invitation fixtures explicitly model accounts from the previous release.

## Validation results

| Validation | Result |
| --- | --- |
| All non-browser `scripts/*.test.mjs` suites | **103 passed, 0 failed, 0 skipped** |
| Browser regression suite (`scripts/phase9b-browser.test.mjs`) | **4 passed, 0 failed, 0 skipped** |
| TypeScript (`npx tsc --noEmit --incremental false`) | Passed |
| Next.js production build in the isolated browser fixture | Passed |
| JavaScript syntax checks for changed API/admin modules | Passed |
| Git whitespace check | Passed |

The non-browser run includes the new authentication workflow suite, cookie/CSRF checks, authorization, email queue/provider, migration/isolation, Tally/reporting, attendance, leads, field activity and recovery tests. Commands are run without loading project `.env` files. The complete non-browser run preloads `scripts/phase8-isolation.mjs` to reject external network traffic, disables baseline restore, and restricts test database paths to the operating-system temporary directory.

Specific security checks passed for:

- Immediate Login ID and email login for new RM and Salesperson accounts.
- Rejection of missing/weak credentials, duplicate IDs/emails and invalid reporting managers.
- Rejection of employee access to admin account creation, resets and account lists.
- Current-password verification, confirmation mismatch, short passwords and unauthenticated password changes.
- Revocation of both existing devices, current sessions, reset tokens and queued recovery payloads.
- Unchanged roles, RM assignments, customer ownership, visits and follow-ups after password changes/resets.
- Concurrent password changes and concurrent reset-link use.
- Reset-link expiry, replay rejection, generic recovery responses and duplicate-request cooldown.
- Cookie CSRF enforcement, cookie expiry after change and rejection of revoked cookie sessions.
- Legacy activation/resend, signed delivery events and stale links after admin changes.
- Password omission from server logs, API responses, email content and account-creation audit records.
- Additive migration preservation of existing account values and pending activation tokens, plus repeatability.

The browser run covers desktop role dashboards, reporting downloads, legacy invitation resend, mobile CRM navigation, admin creation through the real dialog, immediate employee Login ID sign-in, Profile navigation, confirmation errors, voluntary changes for both roles, session clearing and mobile overflow. Chromium blocks requests to external hosts. Resend and speech providers are mocked. The build uses a disposable application copy with `.env` files and data excluded; the fixture replaces the Google font import only in that copy to avoid external font downloads.

Local evidence is under the ignored directory `scratch/auth-workflow-validation/`: `regression.log`, the isolated build/server logs and browser screenshots. Production data and environment files were not opened for writes by this work.

## Outstanding risks and deployment notes

1. **Historical audit entries:** the previous logger redacted `password` but missed `initialPassword`. Earlier account creation could therefore have written an initial password to audit details. This change prevents future leakage. Existing production logs, database rows and backups were not inspected or modified; a separately authorized review/remediation is needed to determine historical exposure.
2. **Deployment migration:** deploy the API and client together after the normal database backup/review process. Migration 011 must be present before the new account queries run. The production startup guard remains in place. No production migration was applied here.
3. **Real email delivery:** tests mock Resend and do not prove company-domain verification or inbox delivery. Production recovery still requires the existing approved sender, Resend configuration, public HTTPS app URL and queue encryption key. Existing pending invitations retain their original expiry.
4. **In-flight email:** an email already submitted to Resend cannot be recalled. Its link becomes unusable immediately after password change/reset because the database token is revoked; unsent queued payloads are canceled and erased.
5. **Existing account IDs:** old accounts continue using email. The migration deliberately does not derive Login IDs from employee codes or rename accounts.
6. **Existing deployment architecture:** authentication still uses SQLite sessions and in-process rate limits. Multiple independent API instances would need shared session storage/rate limiting as part of a separate deployment change.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
