# PSSPL Phase 1 Regression and Readiness Verification

**Date:** 17 October 2026  
**Branch:** `fix/psspl-phase1-security`  
**Scope:** Phase 1 security, authorization and data-protection changes only. This verification did not start Phase 2.

## Acceptance status

**CONDITIONAL PASS.** The isolated authorization/security regression suite, AI-provider and attendance tests, TypeScript check, and changed-code review passed. Code-level Phase 1 readiness is acceptable for further isolated development, with an explicit ownership policy recorded below: persisted user/team ownership is authoritative and RM aliases alone do not grant access. It is **not ready for production deployment**: production origins, durable backup storage, key handling, scheduling, startup/migration approval and live recovery checks are not configured or verified. Several end-to-end workflows and role combinations remain source-reviewed rather than runtime-tested.

**Recommendation:** Phase 2 development may be planned and tested on synthetic data after the user approves it, but first confirm the RM/team customer ownership rule noted below. Do not deploy Phase 1 or use production data for Phase 2 validation until the deployment blockers are resolved and separately verified.

## Tests performed

| Check | Result | Evidence and limits |
| --- | --- | --- |
| `npm run test:security` | **PASS — 10/10** | Disposable SQLite file and synthetic users/customers/invoices. Exercises owned and foreign lead mutations, follow-up mutation and customer checks, RM dormant-reason access, customer detail activity visibility, RM alias collision/assigned-owner/unassigned/cross-team cases, admin company-wide role access, unauthenticated STT rejection, invalid upload response, per-user rate limit, AI product aggregate scopes, production startup guard, and encrypted backup/restore with temporary-file cleanup. |
| `node --test scripts/ai-provider.test.mjs scripts/attendance-live.test.mjs` | **PASS — 11/11 assertions** | Provider fetches are mocked; no AI provider was called. Attendance revision and polling monitor use in-memory fixtures. |
| `npx tsc --noEmit` | **PASS** | Frontend TypeScript check. |
| `git diff --check` | **PASS** | Git emitted existing LF-to-CRLF working-copy warnings only. No whitespace errors. |
| Tally connector diff check | **PASS** | No changes found in `server/tally/` connector implementation files. No live connector or sync was invoked. |
| Production data and migration safety | **PASS — bounded** | Security tests use temporary synthetic DBs. Production startup guard test confirms an existing synthetic DB remains unchanged when approval is absent. No existing project DB was opened by the backend, migrated, seeded or modified. |

The suite does not cover every route, role combination, UI interaction, upload-to-disk path or real integration. The first run after adding two unassigned synthetic customer fixtures exposed an outdated expected fixture count (3 instead of 5); the assertion was corrected and the complete rerun passed. No application behavior defect was exposed by that test correction.

## Security validation

- **Lead authorization:** salesperson A cannot read, update or delete salesperson B's lead; the other user's lead and child records remain present. The assigned lead update/delete path succeeds.
- **Lead-linked activities and service requests:** cross-owner lead IDs are rejected for creation. Lead detail returns only the authenticated owner's activities. Deleting an owned lead preserves another user's child record by clearing its lead association.
- **Follow-ups:** cross-owner toggle, update and delete are denied; a customer outside the salesperson's scope is denied at creation; the owner's mutation succeeds.
- **Customer data:** unassigned rows are denied to sales and RM users, including a row whose `rm_name` matches the RM's spelling alias. An assigned customer detail succeeds and excludes an out-of-team activity while retaining a same-manager team member's activity associated with that customer.
- **RM/team and aliases:** synthetic `Ketan Bhatt` / `Ketan Bhat` spellings resolve to one reporting directory entry. An explicit owner in that RM's reporting team remains accessible; the alias cannot override an owner in another team. RM direct-report access succeeds, cross-team RM access fails, admin-role access succeeds, and RM/salesperson tokens are denied from the admin route. RM router source applies `authenticate` and `requireRole("rm")`; admin router source applies `authenticate` and `requireRole("admin").
- **AI context:** synthetic salesperson context excludes another salesperson's product; RM context includes the direct-report team fixture. Provider error/fallback handling passed mocked tests; no external call occurred.
- **Speech transcription:** unauthenticated request returns 401 before upload/provider work; malformed authenticated request is rejected; the per-user limit is exercised. Provider success, timeout against a mock HTTP server and valid audio upload were not exercised in this pass.
- **Sessions/frontend:** source review confirms server-side token hashing, active-user and idle/absolute-expiry checks, authenticated logout deletion, 401-driven token removal, event-based admin cache clearing, and login redirects in portal shells. A dedicated end-to-end login/logout/expiry test and browser cache-switch test were not run.

## Existing functionality and compatibility

| Workflow | Verification result |
| --- | --- |
| Admin dashboard and admin authorization | Admin router guard and affected data consumers reviewed; unauthorized-role runtime tests and browser dashboard workflows were not run. |
| RM dashboard/team records | RM role guard source-reviewed; synthetic team customer/dormant-reason operations pass. Full dashboard/report-card routes and print output were not run. |
| Salesperson customer management | Synthetic assigned customer read succeeds; unassigned customer read is denied. Customer editing/assignment is an admin workflow and was not run. |
| Leads and follow-ups | Synthetic owner-permitted and cross-user-denied operations pass. |
| Activities and service requests | Cross-user lead relationships are denied; customer detail activity visibility is scoped. Full form workflows were not browser-tested. |
| GPS/check-in and visit lifecycle | Attendance revision and frontend polling tests pass. GPS permission/device capture, check-in/out UI, visit start/complete and real movement history were not exercised. |
| Voice recording and voice-note storage | Route source review confirms authentication, visit-owner check before disk upload, size limit and audio MIME allowlist. No filesystem upload or browser recording test was run; durable/private storage policy remains unverified. |
| Speech-to-text | Auth, malformed input and rate-limit behavior pass; actual transcription intentionally not called. |
| Ask AI | Synthetic authorization context and mocked provider suite pass; authenticated endpoint/browser interaction and live answer intentionally not exercised. |
| Sales and RM reporting | Connector source is unchanged. Report and AI-context scope source reviewed; no report snapshot comparison, real Tally data or browser/print rendering was used. |

No regression was observed in the automated checks. This is not proof that every existing screen and integration remains unchanged at runtime.

### Ownership policy and decision needed

The implementation treats `tally_customers.owner_user_id` and `salesperson_profiles.manager_user_id` as authoritative for sales/RM record authorization. Admin role may access company records, including unassigned customers. Sales users retain same-manager team access; RM users retain direct-report access. `rm-directory.mjs` aliases remain reporting/display metadata and do not independently authorize access. Ownerless customer rows are denied to non-admin users even when `rm_name` matches an alias; this avoids deriving authorization from an unowned record or fuzzy spelling group.

**Decision required before granting access to ownerless alias-mapped customers:** should a customer with `owner_user_id IS NULL` and an RM-directory `rm_name` be considered explicitly assigned to the canonical RM and their whole team, assigned only to the RM, or remain inaccessible until an owner ID is set? The current behavior is fail-closed; no access was added based on an unverified name convention.

`server/rm-routes.mjs` product trends also scopes data by direct-report owner IDs instead of its prior `rm_name`/region predicate. The current tests establish team isolation but not historical report parity for aliases or non-person RM names. Confirm the canonical assignment and report membership rules before changing RM report calculations in Phase 2.

## Backup and recovery readiness

- Synthetic backup command passed using SQLite `VACUUM INTO`; the created backup used the encrypted `PSSPLBK1` AES-256-GCM format, did not expose the fixture text, and restored to a new database with `PRAGMA integrity_check = ok` and expected synthetic rows.
- Tampering was rejected and restore refused to overwrite an existing target. Missing destination configuration failed closed.
- [Database backup and recovery procedure](../operations/database-backup-recovery.md) documents a daily host-scheduled run, encryption-key handling, 30-file retention and restore drill.
- **Production recovery is not ready:** no persistent destination, encryption secret/key escrow, schedule, failure alerting, recovery point/time objective or production-equivalent restore drill has been configured. The documented Render Free filesystem is ephemeral and is not acceptable for the backup destination. Supabase synchronization is not a backup.
- Backup publication now writes to a unique hidden temp file in the destination, fsyncs it, authenticates/decrypts and compares the bytes with the already integrity-checked SQLite snapshot, then atomically renames it to a unique final filename on the same filesystem. Failed runs clean their temp file; a later run removes only tool-named temp files older than seven days. Synthetic tests verify restore integrity, tamper rejection, overwrite refusal, stale-temp cleanup and preservation of recent temp artifacts. A hard-kill interruption was not simulated.

## Remaining findings and deployment blockers

1. **Production CORS configuration:** set `CRM_ALLOWED_ORIGINS` to the exact deployed frontend origin(s). Production defaults to an empty allowlist; without configuration, browser calls from the deployed frontend will not receive CORS permission.
2. **Frontend API URL:** confirm `NEXT_PUBLIC_API_URL` points to the intended deployed API in the production build; the source fallback is loopback and is not a public production endpoint.
3. **Startup/schema gate:** existing production DB startup refuses to proceed unless `CRM_ALLOW_STARTUP_SCHEMA_CHANGES=true`; explicit database migration separately requires `CRM_ALLOW_DATABASE_MIGRATION=true`. Review schema and backup before setting either flag. No migration was run here.
4. **Initial admin creation:** production initialization requires deployment-managed `CRM_ADMIN_EMAIL` and `CRM_ADMIN_PASSWORD` if no admin account already exists. No production credentials were read or changed.
5. **Backup configuration:** provision durable `CRM_BACKUP_DIR`, `CRM_BACKUP_ENCRYPTION_KEY`, separate key escrow, daily scheduler, monitoring and recovery procedures. Do not place the key in source control or the repository `.env`.
6. **Rate-limit scaling:** login/STT rate limiting is in-process memory. Multiple API instances do not share counters; confirm single-instance operation or provide a shared limiter at the deployment edge before horizontal scaling. Proxy-aware client-IP behavior also needs deployment verification.
7. **Browser token storage:** bearer tokens remain in `localStorage`, so an XSS vulnerability could expose them. Phase 1 clears local state on 401/logout but does not move sessions to HttpOnly cookies.
8. **Role-route coverage:** admin allow/deny is tested on the revision route, but login throttling, actual logout revocation, max-age expiry, valid upload ownership, every RM/admin read route, and the complete route matrix lack automated runtime regressions.
9. **Supabase replication:** table allowlist and TLS certificate verification were source-reviewed only. No credentials, cloud connection, ACL/RLS policy, failure/retry behavior or data reconciliation was tested.
10. **Audio retention:** uploads remain on local `data/voice-notes`; encryption, durable private storage, retention/deletion and access/download authorization were not established by this verification.

The audit matrix in `PSSPL_REQUIREMENTS_AUDIT.md` is a historical requirements baseline. Its older individual G03/G09/H01/H02 descriptions are not all rewritten by this verification; section 17 records the earlier implementation evidence. This report supersedes those pre-Phase-1 observations only to the extent supported above.

## Change and safety review

Final hardening changed only the customer authorization helpers in `server/sales-routes.mjs`, the encrypted publication and restore-name validation in `scripts/backup-sqlite.mjs`, the focused synthetic regression tests in `scripts/phase1-security.test.mjs`, and this verification/backup procedure documentation. The broader Phase 1 implementation surfaces reviewed include `server/follow-up-routes.mjs`, `server/rm-routes.mjs`, `server/ai-context.mjs`, `server/stt.mjs`, `server/rate-limit.mjs`, `server/app.mjs`, `server/auth.mjs`, `server/db.mjs`, `server/supabase-sync.mjs`, `server/admin.mjs`, `scripts/migrate.mjs`, `src/lib/api.ts`, `src/lib/use-admin-data.ts`, and the migration. No database or configuration changes were made during final hardening.

Existing uncommitted/untracked work in the shared checkout was preserved. No `.env` or credential file was read or changed. No production DB access, migration, seed, paid provider call, WhatsApp send, Tally synchronization, deployment, commit or merge occurred.

## Later-phase status reference - 17 October 2026

This document preserves the verification results and decisions recorded for this phase. Phases 5, 6 and 7 now have their own local verification reports; earlier statements that a later phase had not started describe the time of that review. See [Phase 7 verification](./PSSPL_PHASE7_VERIFICATION.md) for current implementation, regression results and remaining conditions. Overall local Phase 7 acceptance is CONDITIONAL PASS. Production readiness and final UAT remain pending; final UAT requires user approval.

> Current project status (19 October 2026): See the [production readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
