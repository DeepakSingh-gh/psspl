# PSSPL Phase 7 Verification

Date: 17 October 2026 (Asia/Kolkata)
Branch: `feature/psspl-phase3-rm-report-cards`
Acceptance: **CONDITIONAL PASS** for local implementation and mocked verification. Business approvals, live integrations, browser/device acceptance and production readiness remain outstanding. Final UAT has not started.

## Implemented and reused

### Ask AI and business intelligence

- All three authenticated admin/RM/sales routes use one handler with per-account throttling, strict question limits and validated reporting dates. Admin date controls now reach the context builder; India financial-year rollover is corrected.
- Backend authorization derives scope from the active account. RM context includes their own/direct active salesperson accounts; salesperson context contains their own records. Admin totals include eligible company invoices, including unassigned invoices. Caller-supplied role/scope cannot expand access.
- Complete JSON replaces the former 2,000-character truncation. Context explicitly identifies source, reporting period, current-state CRM metrics, latest sync status/time and age. Missing invoice evidence/targets remain unavailable. No freshness SLA is invented.
- Shared Phase 2 `authoritativeInvoiceWhere`, `netInvoiceAmount` and `netInvoiceLineAmount` remain unchanged. Signed credit notes, staged-record exclusion and synthetic Excel exclusion are preserved.
- Phase 3/4 `calculatePeriodPerformance`, `buildRmManagementInsights`, threshold configuration and planned-visit classification are reused. Exact unique RM names with complete explicit monthly target coverage can produce achievement/review notices. Ambiguous CRM target units are not used.
- The provider selects from seven supported evidence sections: sales, top products, pipeline, follow-ups, visits, aggregate performance and RM performance. The backend validates section IDs and renders its own calculated facts and existing review actions. Provider prose/financial values are never displayed. Invalid provider output returns 503; unsupported questions explain the limitation.
- Existing Gemini/OpenAI timeout/fallback transport is reused. Tests cannot silently load Gemini credentials from the local `.env` fallback. Provider errors remain unavailable responses; provider payloads/secrets are not logged.

### Scheduled WhatsApp reports

- Reused the existing Cloud API transport/configuration names, replacing implicit default-recipient/global EOD sending with protected recipient-specific daily/monthly schedules.
- Schedules require an active CRM recipient, E.164 number, opt-in, approved template/language and business approval reference. Creation is disabled; activation additionally requires an explicit deployment gate and reviewed Graph API version. No recipients, credentials, templates or schedules were configured in the existing database.
- India-time scheduling, prior-calendar-month reports and monthly restart catch-up are implemented. Daily reports cover today after the configured time; missed prior days are not silently backfilled.
- Persistent occurrence uniqueness and atomic claims prevent duplicate processing across overlapping workers/database connections. A unique recipient/cadence constraint also prevents duplicate schedule configuration.
- Every attempt recalculates from current authorized records. Report bodies are not retained for replay. One approved template body parameter is used; oversized reports are blocked rather than truncated.
- HTTP 429 rejection retries after 1 then 2 minutes, at most 3 total attempts. Other 4xx failures stop. Network loss, timeout, 5xx and malformed success become `review`; crash-left `sending` is never automatically replayed.
- Provider acceptance, delivered/read and failed-delivery states are separate. HMAC-verified callbacks advance state monotonically. Early callbacks are durably buffered and reconciled after the send response.
- Legacy free-text/manual report sends return 409 and cannot bypass controls. Opt-out disables the schedule. Schedule/history APIs require admin authorization. Audit output excludes recipient phone numbers and raw AI questions for these new workflows.

### Notifications and training

- Reused existing owner/team-scoped overdue follow-up and management alert routes. Added scoped pending/due-today follow-up counts, upcoming visits, past scheduled visit review counts and RM management attention.
- Sales Hub, legacy RM Team Alerts and Admin Alerts display the new in-app information. An outstanding visit requires owner confirmation; it is not classified as a proven no-show.
- Removed the legacy RM alert's unverified salesperson target list and corrected the admin target tile to show unavailable rather than implying zero shortfalls.
- Updated all three existing SOPs with task procedures, data limits, practice exercises and sign-off fields. Added an operator runbook for protected setup, delivery states, retries, consent withdrawal and deployment prerequisites. Training has not been delivered or signed off.

## Phase 7 files

New files:

- `server/report-snapshot.mjs` — authorized shared financial/CRM reporting context.
- `server/ai-answer.mjs` — grounded evidence selection, response rendering and throttling.
- `server/report-automation.mjs` — admin setup/history, scheduler, claims/retries and signed callbacks.
- `server/reminder-summary.mjs` — scoped in-app reminder/management summaries.
- `database/migrations/004_report_automation.sql` — additive schedules, deliveries and callback metadata; no defaults/backfill.
- `scripts/phase7-automation.test.mjs` — isolated synthetic/mocked acceptance coverage.
- `docs/operations/PSSPL_REPORT_AUTOMATION.md` and this verification report.

Updated files:

- `server/ai-context.mjs`, `server/ai-provider.mjs`, `server/whatsapp.mjs`.
- `server/app.mjs`, `server/admin.mjs`, `server/rm-routes.mjs`, `server/sales-routes.mjs`.
- `src/components/admin/admin-ask-ai.tsx`, `src/components/admin/admin-alerts.tsx`, `src/components/rm/rm-alerts.tsx`, `src/components/sales/sales-hub.tsx`, `src/types/admin.ts`.
- `scripts/ai-provider.test.mjs`, `package.json` (`test:phase7`), `database/migrations/README.md`.
- `docs/training/PSSPL_RM_SE_SOP.md`, `PSSPL_RM_Manager_SOP.md`, `PSSPL_Admin_SOP.md`.
- Requirements audit, both linked matrix parts and evidence register E40. SOP statuses reflect authored documents only; baseline completion counts were not recalculated.

Existing unrelated local edits and Phase 1–6 artifacts were preserved. The file list above identifies Phase 7 work, not the entire dirty working tree.

## Verification results

| Check | Result |
| --- | --- |
| Phase 7 synthetic SQLite/API and mocked transport | 19 passed, 0 failed |
| Phase 1 security | 10 passed |
| Phase 2 Tally accuracy | 6 passed |
| Phase 3 RM intelligence | 4 passed |
| Phase 4 management | 8 passed |
| Phase 5 field workflows | 5 passed |
| Phase 6 lead/report suites | 4 passed |
| Phase 6 authenticated My Day smoke | Passed, HTTP 200 |
| AI provider and attendance suites | 12 passed, including aborted-provider timeout |
| TypeScript (`npx tsc --noEmit` / local equivalent) | Passed |
| Backend syntax: all 27 server `.mjs` files plus 2 changed test files | 29 passed |
| `git diff --check` | Passed; existing line-ending conversion warnings only |

Total: **68 passing test-runner assertions/tests plus the separate passing My Day smoke check**. No final test failures. During development tests identified SQLite uniqueness errors returning 500 instead of 409 and nested-router audit redaction using a changed request path; both were corrected and covered by passing tests.

Phase 7 covers authenticated AI success for all roles, denied roles/no auth, cross-team prompt isolation, server-only evidence output, selected dates/FY rollover, credit-note/synthetic exclusion, unavailable/old/failed sync, provider errors/timeouts, daily/monthly report generation, restart catch-up, recipient approval/deactivation/opt-out, independent-database overlap claims, duplicate prevention, bounded retries/recovery, ambiguous-send holds, disabled/unconfigured transport, pending/overdue reminders, upcoming/past scheduled visits, target consistency, template bounds and forged/early/out-of-order callbacks.

Tests use disposable databases with baseline restore disabled and mocked providers. No application server was running before edits; no normal startup or migration command was executed against the existing CRM database. Migration 004 was applied only as part of isolated test database initialization. No production data, credentials, `.env`, external message, paid AI/STT request, Tally sync, deployment, Git branch change, commit, push, merge, reset, rebase or stash was performed. Work remains local and uncommitted.

## Conditions, business decisions and deployment blockers

1. **Delivery remains disabled:** obtain approved recipient/account/number ownership, opt-in/revocation evidence, report purpose, template/language, cadence and send time. Configure credentials, reviewed supported Graph version, webhook verification/signature secrets and provider status subscription only in a separately approved deployment. Meta request/callback references and their verification limits are in the [operator runbook](../operations/PSSPL_REPORT_AUTOMATION.md).
2. **Migration/operations approval:** approve backup and migration 004 rollout before starting the backend on the existing database. Startup applies pending migrations. Durable SQLite storage, access controls, metadata/phone-number retention, monitoring for held sends and recovery responsibilities need sign-off.
3. **AI is bounded BI:** seven aggregate evidence sections are supported. Arbitrary row-level investigation, regional questions, repeat-customer analysis, causal explanations and open-ended provider coaching are not claimed as implemented. Top products are a top-five subset, not approved thrust products. Legacy sales/RM AI screens default to FY; the admin UI has date controls, and the backend accepts explicit dates for all roles.
4. **Mapping and targets:** automation requires an exact unique RM name and complete monthly target rows; existing report cards may resolve additional aliases. Unresolved mappings and daily/partial-month-start targets remain unavailable. A reviewed shared alias mapping is still needed for broader parity. Thresholds remain provisional where not configured/approved.
5. **Data freshness/coverage:** agree a Tally freshness SLA and verify invoice/line/target coverage. Sync age alone cannot prove complete accounting data. Historical CRM follow-up/pipeline state is not reconstructed for prior report periods.
6. **Delivery limits:** schedules are API-configured; there is no new dashboard schedule editor. One schedule per recipient/cadence is supported. Number/template changes and renewed consent require a reviewed operator workflow. Reports above the conservative template bound need a concise approved format. Ambiguous outcomes favor duplicate prevention over automatic delivery; there is no guarantee of exactly-once remote delivery or force-resend shortcut.
7. **Acceptance remains pending:** browser/device/GPS/audio acceptance, actual training and sign-off, live provider/template/webhook verification and comprehensive production readiness review. Earlier Phase 1–6 limitations are not erased by passing regression tests. In-process AI rate limits require a shared quota mechanism for clustered deployment.

**Decision:** CONDITIONAL PASS for the implemented local Phase 7 scope. Keep delivery off and all changes uncommitted. Wait for the user's approval before starting final UAT.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
