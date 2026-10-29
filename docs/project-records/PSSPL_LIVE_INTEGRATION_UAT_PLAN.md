# PSSPL Live Integration UAT Plan — Tally and WhatsApp

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Status: PREPARED, NOT EXECUTED. No live provider was contacted and no message was sent. Phase 9B evidence is synthetic/mocked only. Execute only after owners authorize an isolated sandbox, named operators and test data. See [client decision register](./PSSPL_CLIENT_DECISION_REGISTER.md).

## Entry controls

| Control | Tally | WhatsApp |
|---|---|---|
| Credentials/access | Dedicated, least-privilege test connector/agent pairing and read-only sandbox company; no production token. Keep secrets in the approved secret manager, never in report artifacts. | Dedicated Meta/provider sandbox credentials, verified test sender, approved template, webhook signing secret and platform access. Keep secrets in secret manager. |
| Named authorization | Finance/data owner identifies company, authorized read window, reconciliation operator and approved redacted evidence location. | Business owner confirms test-recipient ownership/opt-in, purpose, template, language, cadence and operator. Explicitly confirm no customer numbers. |
| Environment | Isolated app and fresh disposable test database or approved sandbox database copy; outbound egress limited to authorized Tally endpoint; backups and rollback owner named. | Isolated app/database, provider sandbox, test-only recipient and test template. `WHATSAPP_DELIVERY_ENABLED` stays false except for a time-boxed authorized sandbox run. |
| Data | Synthetic data preferred. For reconciliation, use a minimal approved, redacted voucher fixture with known totals and no unrelated ledgers. | Synthetic report content only; a controlled test recipient with recorded opt-in. Do not include customer or production data. |
| Change boundary | Do not run normal startup/migrations against existing CRM data. Review schema and migration list first; perform only on disposable/approved copy with rollback rehearsal. | No production sender configuration. Never change credentials to bypass safety; never enable general delivery or scheduled production jobs. |

## Tally test cases

| Case | Procedure | Expected result / evidence |
|---|---|---|
| T-01 Pair and authorization | Pair a dedicated sandbox agent; verify no token appears in logs/artifacts. Attempt an unauthenticated ingestion request. | Authorized pair succeeds; unauthenticated request is rejected. Redacted pairing event and status evidence only. |
| T-02 Company and period scope | Select the approved sandbox company and a short approved period; compare identity and period echoed by CRM to source. | Exact company and inclusive dates match the authorization; other companies and periods are untouched. |
| T-03 Voucher coverage/control totals | Reconcile sales, credit notes/returns, cancellations, taxes/gross/net, duplicates and invoice-line coverage against owner-approved control totals. | Counts and amounts match the approved convention. Every excluded/unsupported voucher is listed; no fabricated mapping or inferred cancellation. |
| T-04 Customer/product/RM mapping | Compare a small approved roster with CRM mappings and unmapped exceptions. | Known rows map to the approved identifiers; ambiguous/unmapped rows remain explicit and are excluded from attributed metrics. |
| T-05 Retry/idempotency | In the sandbox, replay a chunk and replay the same source voucher using approved procedure; compare IDs, counts, lines and totals. | Retries do not duplicate source records or double totals; partial failure recovery leaves prior good data available. The route-level retry fixture is already covered by automated synthetic test. |
| T-06 Interrupted sync and freshness | Interrupt only a sandbox transfer; inspect sync state, cached reports, retry path and timestamps. Resume from a known checkpoint. | Existing published snapshot remains available; failed/old status is explicit; replay is safe; alert reaches the named owner. |
| T-07 Completion and rollback | Compare before/after record counts and control totals; rehearse restoring the disposable database backup and revoking the test connector. | Exact authorized range is retained; rollback restores pre-test state; test credentials are revoked/rotated through approved process. |

## WhatsApp test cases

| Case | Procedure | Expected result / evidence |
|---|---|---|
| W-01 Preflight | Confirm sandbox sender/account ownership, approved test template, language, recipient opt-in, purpose and callback URL/signature. Keep delivery disabled until preflight is signed. | Operator checklist complete, signed approval reference recorded; all non-test recipients absent. |
| W-02 Held/disabled path | With delivery disabled, request a scheduled/report send through the supported test path. | No provider request is made; record remains safely held/disabled with no message content sent. |
| W-03 Single sandbox send | Enable only the approved sandbox path for one synthetic report to the authorized test recipient; record request correlation ID. | Provider accepts or explicitly rejects; no broad audience or customer content. Acceptance is not misreported as delivery. |
| W-04 Signed callback | Deliver provider sandbox sent/delivered/read/failed callbacks and a forged/invalid signature. | Valid states advance monotonically; invalid signature is rejected; callback and state transitions are redacted and correlated. |
| W-05 Retry/ambiguous outcome | Simulate explicit rejection and an ambiguous timeout using sandbox/mock; inspect retry/hold behavior. | Bounded retry only for explicit rejection; ambiguous result is held for operator review and never blindly resent. |
| W-06 Opt-out/revocation | Mark the test recipient opted out or revoke authorization; attempt another sandbox run. | Send is denied/held and audited. Re-enable only with renewed documented authorization. |
| W-07 Disable and rollback | Disable sandbox delivery, stop schedule, inspect pending queue and revoke test token/webhook secrets per approved procedure. | No further outbound calls; pending/ambiguous sends are preserved for review, not auto-retried; evidence contains no credentials or phone number. |

## Logging, evidence and recovery

Capture environment label, approver/reference, operator, UTC and India-local timestamps, build revision, test case ID, redacted correlation IDs, sanitized request/result summaries, before/after counts and control totals, screenshots where authorized, and rollback confirmation. Store evidence in the approved restricted location. Do not put tokens, secrets, full phone numbers, customer names or raw accounting exports in this repository.

On mismatch, stop the run; leave the last-known-good snapshot intact; mark the run failed; preserve sanitized logs; do not retry uncertain messages or reimport into an existing database. The named operator compares the failed case with the approved scope and executes the rehearsed rollback on the isolated copy. Revoke the sandbox pairing/session if compromise is suspected. Record a defect and obtain owner approval before repeating.

Completion requires every applicable case to have PASS/FAIL/BLOCKED plus evidence, finance/business reconciliation and security/data-owner review. This plan itself is preparation evidence only; it does not change E03 or G07 from NOT VERIFIED.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
