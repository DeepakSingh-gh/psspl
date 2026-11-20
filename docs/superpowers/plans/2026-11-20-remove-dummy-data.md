# Remove operational dummy data

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

User approval: “to dummy data remove karo” authorizes the dummy-removal subset of the prior audit. Existing UI/responsive changes, genuine Tally records, CRM user-entered work, assignments, targets and supplied historical reports must be preserved. Connector protocol hardening is outside this task.

## Implementation and verification

- [x] Remove operational frontend snapshot/demo transformations and invented summary/thrust figures. Retain actual report/PDF previews and unavailable states. Move showcase generators to isolated test fixtures.
- [x] Prevent seed/sample scripts and workbook imports from reintroducing fake operational rows. Require isolated test-database opt-in for showcase tools; retain genuine imported history and masters.
- [x] Add a dry-run-first cleanup utility with a consistent SQLite backup, transaction, archived row JSON and preservation checks. Remove only proven fixture IDs/source markers, including `excel-import` invoice projections, after archiving.
- [x] Resolve the nine `dummy-1`…`dummy-9` references to unique exact-name connector-imported masters. Preserve all existing activities, actors and actual customer ownership; refuse ambiguous/missing replacements rather than guess.
- [x] Verify cleanup behavior in an isolated database first, including rollback, ambiguous mappings, fixture foreign keys, actual rows, idempotence and preservation of original real records.
- [x] Run dry-run on the current DB, back up, apply the reviewed cleanup, and verify zero known fixture rows in active tables, preserved actual transactions, real CRM activity IDs and foreign-key integrity.
- [x] Run relevant tests, TypeScript/build, browser evidence where available and independent review. Report exact archived counts and remaining limitations.

No production deployment, credential changes or irreversible deletion of actual business records. Database removal means archived and excluded from active tables, with a pre-cleanup full snapshot; it does not erase the archived source material.

## Execution ledger

Work stays in the existing checkout as requested. Frontend and seed/import safeguards are independent delegated tasks; root owns cleanup implementation and the actual database action. All existing responsive changes remain uncommitted and preserved.

Read-only preflight found nine dummy masters, three demo visits and one demo expected order. All nine masters have exactly one same-name connector-imported counterpart. Non-demo dependencies: four visits, three customer activities, one expected order and one service request. These must be relinked, never deleted. Excel projections: 868 “Monthly Sales Invoice” and 22,752 “RM Product Invoice” rows, with `source_sync_id='excel-import'` and synthetic GUIDs. Existing authoritative financial queries already exclude these projections.


Completed: verified backup and transactional cleanup applied; 48,124 row snapshots retained, 9 genuine user activity links preserved; all real invoices/lines/targets/users/products/payments and historical aggregates compare unchanged. Active fixture counts are zero; database integrity/FKs pass. Independent review findings corrected; unit, browser/PDF, importer, TypeScript and build checks passed. Cloud mirror verification remains a reported TLS limitation, not a claimed successful cleanup.
