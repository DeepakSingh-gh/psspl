# Gmail SMTP and employee account emails

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Current local behavior: 21 October 2026. This guide describes the source in this workspace, not a confirmed production rollout.

## What the admin sends

Open **Users & access → Add user**. Enter the employee details and confirm the initial password. A salesperson must have an active reporting RM.

- **Create user** saves an active account without sending email.
- **Create user & Send Email** saves the account, then explicitly requests an account email to the entered employee email address. The admin-entered initial password is included.
- After creation, **Send Account Email** remains available in the same drawer after recipient approval. The password field is prefilled from the creation form's component memory until submission or closing.
- For an existing account, open **Manage → Account email**. Re-enter the current password in **Current password to include in email**, approve the recipient and send. Leave it blank to send employee details without a password. The API verifies the supplied password against the current account hash; it does not retrieve or reset it.
- The **Email / Send Test Email** button/dialog was removed from Users and roles on 22 October. The backend test-email capability remains; no test email is sent by this UI update.

The employee can immediately use Login ID or registered email with the same admin-created password on a reachable instance of this CRM. First-login password change remains optional. Creating the account alone does not make the locally running CRM accessible from another device.

## Professional email format

A branded, mobile-compatible HTML email and plain-text alternative contain:

| Sign-in details | Employee details |
| --- | --- |
| Login ID | Full name |
| Registered email address | Mobile number |
| Initial/current password, if supplied and verified | Role |
| CRM access URL, when usable for this recipient | Reporting RM name |
| Optional one-time password setup link, when usable | Region and territory |
| | Employee code, including a generated code when the form was blank |
| | Monthly target in INR crore, including zero |

Confirm-password is a validation field and is not repeated. Missing optional profile values are labelled; a manager that does not apply to the role is shown as not applicable. Values come from saved user/profile records, not arbitrary extra email-body fields. HTML characters are escaped, while the plain-text password retains its exact characters.

## Gmail configuration

The existing `.env` variable names were inspected before adding SMTP placeholders. Resend settings remain supported. Enter secrets directly in the ignored local `.env`; never put an App Password into documentation, chat, source control, frontend variables or logs.

```dotenv
CRM_EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=deepaksingh873785@gmail.com
SMTP_PASS=
EMAIL_FROM=deepaksingh873785@gmail.com
APP_BASE_URL=http://localhost:3000
CRM_EMAIL_LOCAL_TEST_RECIPIENT=deepaksingh873785@gmail.com
CRM_EMAIL_QUEUE_KEY=
```

The blank secret values above are placeholders, not instructions to erase existing configuration. `SMTP_PASS` is the sender's Google App Password, not their normal Gmail password. Preserve the existing `CRM_EMAIL_QUEUE_KEY`; it must be 64 hexadecimal characters representing 32 random bytes. Changing it makes pending encrypted messages unreadable.

The interim sender is `deepaksingh873785@gmail.com`. To switch to the final admin mailbox later, update `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` and the local-test recipient together, using that mailbox's SMTP credentials. `EMAIL_FROM` must match the authenticated sender; an optional display name is supported. No company domain is required for this Gmail configuration.

SMTP requires TLS, retains certificate validation, uses bounded timeouts and disables protocol/debug logging. `CRM_EMAIL_PROVIDER=resend` retains the existing Resend SDK and signed-webhook delivery tracking; `disabled` prevents submission. Provider changes do not reroute jobs already queued for a different provider.

## Localhost and remote access

Email transport and CRM accessibility are separate. Gmail can send an account-details email even when the CRM has only a localhost URL.

- For an employee on another device, account emails omit unusable localhost CRM/setup links and explain that remote access will be provided later. Employee details and an explicitly supplied password can still be emailed.
- Local setup/reset links may only go to `CRM_EMAIL_LOCAL_TEST_RECIPIENT`, falling back to `SMTP_USER`, outside production. The approved tester must open them on the CRM host computer.
- The policy treats localhost, `.localhost`, 127.x.x.x, ::1 and 0.0.0.0 as local. Production rejects local links and requires HTTPS.
- Forgot Password remains a recovery-link workflow. It requires a usable CRM URL and does not substitute a profile-only email for a working reset link. Its public response stays generic for unknown, known and locally blocked accounts.
- A URL mentioned in older deployment reports is not proof that the newly created local account exists in that remote database. Do not point local account links at a different deployment without verifying its API and account database.

Configure an approved, employee-reachable HTTPS `APP_BASE_URL` and matching API/data deployment for remote sign-in and recovery. Account emails then include the CRM URL and optional password setup link automatically.

## Tokens, passwords and encrypted queue

Password setup and Forgot Password use random, hashed, single-use reset tokens with the existing 15-minute expiry. Legacy activation links keep their 48-hour expiry. New links use browser-only URL fragments; the form removes the token from the address bar and submits it in the request body. Older query-token links remain supported.

The user table stores salted scrypt hashes, not retrievable passwords. The creation UI retains the entered password only in component memory until accepted/pending submission or closing. Explicit password-email requests are checked against the current hash; a wrong password is rejected without sending or changing the account.

Email templates, including a requested initial password, are encrypted in the durable queue using AES-256-GCM. Payloads are erased on accepted or terminal outcomes, expiry, cancellation and account/password revocation. An encrypted credential-version fingerprint prevents an unsent credential email from being submitted after the password changes. Passwords, tokens and SMTP secrets are not returned by send/status APIs or recorded in audit details. SMTP logs use fixed reason labels, and Resend's raw development-error logger is suppressed.

Account emails without usable links use the separate `account` queue purpose, expire after one hour and do not create or invalidate reset tokens. Active status, recipient identity, current tokens where applicable, credential version and intended link policy are checked before submission.

## Delivery status and duplicate requests

- `accepted` means Gmail/provider accepted the message, not that the inbox received it. Check Inbox and Spam separately. SMTP messages never become `delivered` automatically.
- Resend's signed delivery webhook may confirm `delivered`, bounce or other supported outcomes. SMTP message IDs are namespaced and are not reconciled as Resend events.
- Account/reset requests have a 60-second cooldown and pending-job checks. The admin send operations also have a limit of 10 requests per administrator per 15 minutes.
- A duplicate request returns the previous delivery status. The UI explains when the earlier email was already accepted instead of presenting cooldown as a send failure.
- Explicit temporary SMTP rejections and pre-submission connection failures may retry using the existing bounded queue schedule: up to five attempts within one hour and the message/token expiry.
- Ambiguous SMTP submission errors or expired worker leases become `unknown` and are not automatically replayed. Stable Message-IDs are not treated as a server-side deduplication guarantee. Review uncertain sends before retrying.
- The fixed arbitrary-recipient test operation sends directly without automatic retries; it does not create a fake employee or recovery token.

## Admin APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/admin/email/status` | Configuration readiness only; does not connect to Gmail or expose secrets. `connectionStatus` is `not_checked` for this endpoint. |
| `POST /api/admin/email/test` | Explicit recipient and `confirmSend: true`; fixed test content only. |
| `POST /api/admin/users/:id/account-email` | Active RM/salesperson; `confirmSend: true`, optional `initialPassword` to include after verification. |
| Existing password-reset request/completion APIs | Generic recovery response and single-use reset completion; unchanged password recovery semantics. |

Responses may include `passwordIncluded`, `setupLinkIncluded`, `previousDeliveryStatus`, `reason` and `deliveryStatus`. They never contain the password or raw token.

## Schema and rollout

- Migration `013_email_queue_provider.sql` pins each queued job to its selected provider. Existing jobs default to Resend.
- Migration `014_account_email_notices.sql` adds the `account` purpose to queue/delivery constraints while preserving existing rows and indexes. It rebuilds those two tables transactionally; it is not just an added column.
- No additional migration is required for the professional template or verified password inclusion; those changes use encrypted payload metadata.
- Before production rollout, back up the target SQLite database and queue encryption key, review pending jobs, apply reviewed migrations, configure backend secrets, verify outbound SMTP 465 access and deploy matching frontend/API code. Do not start the worker against unreviewed pending work.
- Gmail account policy and sending quotas still apply. Production deployment and inbox delivery are not established by local tests or SMTP authentication.

## Recorded local validation and sends

These are scoped implementation results from the current conversation; no tests or live sends were rerun for the documentation-only update.

- Gmail connection and authentication were verified successfully using the locally entered App Password; no message was sent by that verification.
- The user authorized account notices from the interim sender to `missionunstoppable101@gmail.com`. Local queue records showed provider acceptance, including the account with Login ID `0014`. The user subsequently shared an inbox screenshot showing earlier notices. The application does not independently confirm SMTP inbox delivery.
- Those earlier real notices did not contain passwords. No real password-bearing email was sent during implementation of the professional credential template; an existing account needs its password re-entered by the admin to include it.
- Latest authentication suite: 12 tests passed with mocked Resend and 12 with mocked Gmail SMTP. Professional template tests (2), SMTP queue/credential-version checks (1), durable restart queue checks (1), Resend provider checks (2) and legacy phase-8 workflows (11) passed in their respective runs. Do not add reruns as unique coverage.
- Populated migration preservation was tested separately. Browser checks verified create/send password forwarding, clearing after submission, password re-entry and wrong-password feedback. The professional email was visually checked at mobile width. TypeScript and the production build passed.
- Tests use disposable databases, synthetic passwords and mocked email providers. The separately authorized live notices are distinguished from these tests. No production deployment or Git push was performed.

```powershell
node --test scripts/account-email-template.test.mjs scripts/smtp-email-queue.test.mjs scripts/auth-email-queue.test.mjs scripts/email-provider.test.mjs scripts/auth-workflow.test.mjs
$env:CRM_TEST_SMTP='true'
node --test scripts/auth-workflow.test.mjs
Remove-Item Env:CRM_TEST_SMTP
node --test scripts/account-notice-migration.test.mjs scripts/phase8-workflows.test.mjs scripts/auth-cookie.test.mjs scripts/admin-user-deletion.test.mjs scripts/archived-employees.test.mjs
npx tsc --noEmit
npm run build
```

## Source locations

`server/smtp-email.mjs`, `server/email-provider.mjs`, `server/email-link-policy.mjs`, `server/account-email-template.mjs`, `server/email-templates.mjs`, `server/auth-tokens.mjs`, `server/auth-email-queue.mjs`, `server/admin.mjs`, `src/components/admin/admin-users.tsx`, `src/lib/api.ts` and migrations 013/014 implement this workflow. Tests include the authentication fixtures and the email/template/queue/migration suites listed above.

References: [Nodemailer SMTP](https://nodemailer.com/smtp), [Gmail guide](https://nodemailer.com/guides/using-gmail), [Resend setup](resend-email-authentication.md), [backup and recovery](database-backup-recovery.md).

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
