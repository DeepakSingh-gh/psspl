# Resend email authentication setup

The CRM sends account invitations and password reset links from the Express API through the official Resend Node SDK. Sending remains disabled unless configured. The browser never receives the Resend API key.

Current local status (19 October 2026): Rudra Kumar's invitation attempt is `provider_rejected`; no delivery is recorded. `onboarding@resend.dev` is a test sender and is the likely restriction for his different recipient address, although the exact Resend rejection text was not retained. Verify a company domain and change `EMAIL_FROM` before inviting other employees. `RESEND_WEBHOOK_SECRET` remains unset and is needed for signed delivery tracking; it did not cause this provider rejection. See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md).

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

- Invitations use random single-use links valid for 48 hours. The account stays inactive until the employee sets a password through the link.
- Admin can open any inactive account in **Users & access** and choose **Resend invitation**, including an account created while email delivery was disabled. The first usable invitation is issued only after the required backend settings are present.
- Password reset links use random single-use tokens valid for 15 minutes. Responses remain the same for known and unknown emails. Successful reset revokes existing sessions.
- Requests are rate-limited. Repeated issuance for the same account and purpose is held for 60 seconds; a queued or processing email also blocks a new link. Once the prior send reaches a terminal state, resend invalidates its link.
- The Resend SDK retries HTTP 429, 5xx, and concurrent idempotency responses using the same idempotency key. Network outcomes that remain ambiguous are recorded as unknown. Application logs omit credentials and raw links; review SDK/provider error logging in the deployed environment before enabling verbose diagnostics.
- Migration `009_auth_email_queue.sql` adds durable SQLite jobs. Recipient, link, and template are encrypted with AES-256-GCM. The worker resumes at startup and every 15 seconds, claims jobs with a lease, checks that the token is still current and unexpired, and retries transient failures with the same idempotency key (up to five queue attempts within one hour). Accepted and terminal jobs have their encrypted payload erased. Provider acceptance is not proof of delivery; only a signed `email.delivered` webhook confirms delivery.
- Apply additive migration `010_auth_email_pending_events.sql` on databases that recorded 009 before its pending-webhook table existed. Without this table, invitation requests can queue a job and then return HTTP 500 when the worker starts. Back up the database first; check existing queued jobs before enabling the worker because it may submit them immediately after the repair.
- The one-hour retry ceiling is within [Resend's documented 24-hour idempotency-key retention](https://resend.com/changelog/idempotency-keys). A provider response reporting a concurrent request with the same key is retried.
- Apply the additive migration through the approved database migration and backup procedure before enabling Resend. The queue requires persistent SQLite storage and the same queue key on every API instance. Inspect queued/failed job counts during operations; keep the key available through database recovery.
- For local testing, keep email disabled or mock the provider. `http://localhost` links only work on the machine running the CRM; production invitations require the approved public HTTPS URL.

## Launch checks

- Verify the sender domain, SPF, DKIM, and DMARC in the Resend dashboard.
- Confirm the API key is only in the backend runtime and the sender address belongs to the verified domain.
- Confirm activation/reset links use the production frontend URL.
- Verify webhook signature delivery and a test message's delivered event.
- Confirm the business owner approves real invitation recipients before sending.
