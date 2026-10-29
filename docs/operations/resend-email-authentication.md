# Resend email authentication setup

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

This guide covers the preserved Resend provider. For the current Gmail sender, professional full-profile emails, verified initial-password inclusion and local/remote behavior, see [Gmail SMTP and employee account emails](gmail-smtp-authentication.md). **Create user** does not send; **Create user & Send Email** explicitly sends the admin-entered initial password and employee details. Existing-account emails require password re-entry to include it. Password recovery remains link-only. The existing Resend activation/reset behavior below remains supported.

The CRM sends requested password reset links and explicitly requested legacy account invitations from the Express API through the official Resend Node SDK. New admin-created accounts work immediately. The save-only creation action does not trigger email; the explicitly selected create-and-email action does. Sending remains disabled unless configured. The browser never receives the Resend API key.

Historical Resend incident (19 October 2026; not the current SMTP status): Rudra Kumar's invitation attempt is `provider_rejected`; no delivery is recorded. `onboarding@resend.dev` is a test sender and is the likely restriction for his different recipient address, although the exact Resend rejection text was not retained. Verify a company domain and change `EMAIL_FROM` before inviting other employees. `RESEND_WEBHOOK_SECRET` remains unset and is needed for signed delivery tracking; it did not cause this provider rejection. See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md).

## Configure Resend

1. Add the company sending domain in the Resend dashboard. Publish the exact DNS records Resend provides for domain verification, SPF, and DKIM. If the domain already has SPF, merge the authorized sender into that record; do not create a second SPF record. Add a DMARC policy at `_dmarc.<domain>` following the organization's mail policy; coordinate with IT before enforcing a reject policy.
2. Wait for Resend to verify the domain. Create a production API key with the minimum required email-sending permission. Keep it in the backend secret manager or local ignored `.env`, never in source control or `NEXT_PUBLIC_*` variables.
3. Set the backend environment:

   ```dotenv
   CRM_EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   EMAIL_FROM=PSSPL CRM <crm@verified-domain.example>
   APP_BASE_URL=https://crm.example.com
   RESEND_WEBHOOK_SECRET=whsec_...
   CRM_EMAIL_QUEUE_KEY=<64 random hexadecimal characters>
   ```

   Replace example values with approved values. `APP_BASE_URL` must be the reachable HTTPS URL employees use to open activation and reset links. Generate `CRM_EMAIL_QUEUE_KEY` from 32 cryptographically random bytes and preserve it in the backend secret manager and recovery backups; changing it before the queue drains makes pending links undecryptable. Legacy `CRM_EMAIL_FROM` and `CRM_PUBLIC_URL` names remain accepted for compatibility.
4. In Resend, configure a webhook at `https://<api-host>/api/webhooks/resend` for `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, and `email.suppressed`. Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`. The API verifies signed raw webhook bodies before updating delivery status.
5. Restart the backend, then run a controlled test with an approved recipient. Verify the provider accepted the message and confirm the delivered event before treating it as delivered. The admin user list distinguishes accepted, sent, delivered, delayed, bounced, and failed states.

## Authentication behavior

- Admin supplies Login ID, email, role and an initial password when creating an account. The account is active immediately and accepts Login ID or work email with that password. **Create user** saves without email; **Create user & Send Email** explicitly sends the supplied initial password and full saved employee profile. **Manage > Account email** supports an optional re-entered current password, verified against the account hash. No password is recovered from the hash or returned in API/audit output. A usable app URL enables an optional setup link; local-only employee emails omit unusable links.
- RM, Salesperson and Admin can voluntarily change passwords through **Profile > Security** using the current password, a new password and confirmation. Passwords must contain 12 to 200 characters. Successful changes sign out all sessions, including the current one.
- Previously issued invitations remain supported: their random single-use links stay valid for 48 hours. These legacy accounts remain inactive until activation or an explicit administrative status change; creating new accounts does not activate old pending accounts.
- Admin can open any inactive account in **Users & access** and choose **Resend invitation**, including an account created while email delivery was disabled. The first usable invitation is issued only after the required backend settings are present.
- Password reset links use random single-use tokens valid for 15 minutes. Responses remain the same for known and unknown emails. A successful reset or admin password replacement revokes all sessions, activation/reset tokens and queued account emails for the target user. Existing passwords are never retrievable. A password replacement does not silently activate a disabled account.
- New reset/setup URLs use browser-only token fragments; legacy query-token links remain compatible.
- Requests are rate-limited. Repeated issuance for the same account and purpose is held for 60 seconds; a queued or processing email also blocks a new link. Once the prior send reaches a terminal state, resend invalidates its link.
- The Resend SDK retries HTTP 429, 5xx, and concurrent idempotency responses using the same idempotency key. Network outcomes that remain ambiguous are recorded as unknown. Application logs omit credentials and raw links. The SDK's raw development-error logger is overridden with a fixed reason label; do not enable protocol/message debugging.
- Migration `009_auth_email_queue.sql` adds durable SQLite jobs. Recipient, link, and template are encrypted with AES-256-GCM. The worker resumes at startup and every 15 seconds, claims jobs with a lease, checks that the token is still current and unexpired, and retries transient failures with the same idempotency key (up to five queue attempts within one hour). Accepted and terminal jobs have their encrypted payload erased. Provider acceptance is not proof of delivery; only a signed `email.delivered` webhook confirms delivery.
- Apply additive migration `010_auth_email_pending_events.sql` on databases that recorded 009 before its pending-webhook table existed. Without this table, invitation requests can queue a job and then return HTTP 500 when the worker starts. Back up the database first; check existing queued jobs before enabling the worker because it may submit them immediately after the repair.
- The one-hour retry ceiling is within [Resend's documented 24-hour idempotency-key retention](https://resend.com/changelog/idempotency-keys). A provider response reporting a concurrent request with the same key is retried.
- Apply pending migrations through the approved backup and migration procedure before enabling delivery. Migration 013 pins the queue provider; migration 014 preserves and rebuilds queue/delivery tables to allow token-free account notices. The queue requires persistent SQLite storage and the same queue key on every API instance. Inspect queued/failed job counts during operations; keep the key available through database recovery.
- For automated local testing, keep email disabled or mock the provider. A separately authorized real account-details email may be sent without a remote link; tests do not authorize live sends. `http://localhost` links only work on the machine running the CRM; production invitations require the approved public HTTPS URL.

## Launch checks

- Verify the sender domain, SPF, DKIM, and DMARC in the Resend dashboard.
- Confirm the API key is only in the backend runtime and the sender address belongs to the verified domain.
- Confirm activation/reset links use the production frontend URL.
- Verify webhook signature delivery and a test message's delivered event.
- Confirm the business owner approves real invitation recipients before sending.

Implementation and test report: [20 October authentication workflow](../superpowers/reports/2026-10-20-authentication-workflow.md). Migration `011_user_login_id.sql` is additive and leaves existing accounts on email login. It has only been applied to disposable test databases during this change.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
