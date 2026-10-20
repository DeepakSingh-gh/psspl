# Phase 7 report automation operator runbook

Local implementation only. External delivery is disabled by default. Do not start the application against the existing database during development: startup applies migrations. Migration `004_report_automation.sql` was exercised only on disposable synthetic databases. Review a backup and approve migration application separately before rollout.

## Business prerequisites

Obtain the recipient's CRM account, verified ownership of their WhatsApp number, opt-in evidence and revocation process, authorized scope, template approval, language, daily/monthly cadence, send time in Asia/Kolkata and written business approval reference. No actual recipients/templates/schedules were supplied in Phase 7.

Templates must accept **one body text parameter** for this report format; review classification, content and provider limits before enablement. Reports exceeding the conservative 1,024-character parameter bound are blocked, not truncated. Larger management audiences need an approved concise template/report design before activation. This is an implementation bound, not certification of provider policy compliance.

The transport retains the existing Cloud API provider. An approved deployment must configure `WHATSAPP_DELIVERY_ENABLED=true`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and a reviewed supported `WHATSAPP_GRAPH_VERSION` such as `vNN.0`. There is deliberately no version default or legacy global recipient fallback. The webhook also requires `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. No credentials or `.env` files were changed by Phase 7.

Meta's [template request reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/) and [webhook validation reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/) informed the request shape and signed callback handling. Those SDK pages are archived references; confirm the supported Graph version, business policy and template contract in the current Meta console before deployment. No live request was made.

## Protected setup API

All setup/history endpoints live under `/api/admin/report-automation` and require an authenticated admin. The existing admin audit records successful mutations. There is no new schedule editor UI. Do not put tokens into request bodies or logs.

- `GET /`: returns configuration availability, sanitized schedules and latest 100 delivery records; full history remains in SQLite. Phone numbers and report bodies are not in the list response.
- `POST /`: body fields are `recipientUserId`, `phone` (E.164), `cadence` (`daily` or `monthly`), `sendTime` (`HH:mm` India time), `templateName`, `language`, `approvalReference`, `optedIn` and `templateApproved`. Creation is always disabled. Exactly one schedule per user and cadence prevents duplicate configuration.
- `PATCH /:id` with `enabled: true`: requires opt-in/template approvals and the deployment configuration. Use `enabled: false` to stop the schedule.
- `PATCH /:id` with `optedIn: false`: revokes opt-in and disables the schedule. Renewed consent and changes to number/template require an explicitly reviewed operator workflow; the API intentionally does not silently restore opt-in or change recipient identity.
- Legacy `/api/admin/reports/send-whatsapp` responds 409. Free-text/default-recipient delivery cannot bypass schedule controls.

## Timing, scope and calculations

The cron runs every minute in Asia/Kolkata, with process overlap protection and persistent atomic claims. Startup checks due reports only when the delivery gate is enabled. Daily occurrences are generated after the configured time for today; missed earlier days are not automatically backfilled. Monthly occurrences cover the complete previous calendar month and catch up after restart during the following month. Retries for already-created occurrences survive restart.

Each generation/retry rechecks that the account is active and derives scope from its current role/team. Admin sees company invoices, including unassigned customers; RM sees their own/direct active salesperson accounts; salesperson sees their own accounts. No report payload is stored for later replay. Ownership changes therefore affect retries; review any reassignment before enabling delivery.

Net sales share `server/tally/metrics.mjs`; Excel projections and staged invoices are excluded. RM target calculations share Phase 3 performance/insight functions, convert explicit `target_lakh` to INR, require exact unique RM identity and complete monthly target coverage, and do not use ambiguous CRM target units. Daily/partial-month-start targets are unavailable. Alias resolution is deliberately narrower than report cards; unresolved aliases need a reviewed shared mapping before automation can report them. Top-five products are not a designated thrust list. Follow-ups/pipeline/visit attention are current snapshots, not historical period state. Missing invoices are unavailable, never fabricated zero sales. No freshness SLA is assumed: sync state/time/age require review.

## Delivery states and recovery

`pending → sending → accepted → delivered → read` is the normal path. Acceptance is not delivery. A signed callback can also mark failed delivery; failures never overwrite delivered/read. Callback events are retained without message contents and reconcile even if they arrive before the send response.

Only an explicit HTTP 429 rejection retries: 1 minute then 2 minutes, at most 3 total attempts. Other 4xx failures stop. Timeouts, network loss, 5xx, malformed success and sender exceptions become `review`. A process crash can leave `sending`. **Neither review nor sending is automatically replayed:** investigate the provider before taking any action. The system favors avoiding duplicates over guaranteed delivery; there is no claim of exactly-once remote delivery after ambiguous outcomes. No admin “force resend” bypass exists.

Subscribe the reviewed HTTPS callback `/api/whatsapp/webhook`. GET verifies the subscription token; POST requires HMAC-SHA256 over the raw body using the app secret. Unsigned/forged callbacks are rejected. Configure the provider's delivery-status subscription separately. Logs retain only generic error codes; raw provider payloads, tokens and report bodies are not logged by the sender.

Schedule approval/consent evidence, SQLite file protection, retention for schedule phone numbers and callback/delivery metadata, secret rotation, the durable backup procedure, shared-database deployment topology and monitoring for held deliveries all need owner sign-off before production. In-process AI throttling is not a cluster-wide quota. An approved provider sandbox/live verification and browser/device/training acceptance remain outstanding.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
