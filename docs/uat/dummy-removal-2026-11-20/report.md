# PSSPL CRM dummy-data removal ? 20 November 2026

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Authorized by the user: ?to dummy data remove karo?. Completed against the existing local SQLite CRM database, with a pre-cleanup full backup and transactionally archived row snapshots. This is the dummy-removal subset of the prior audit, not a claim that every broader Tally-integration issue has been resolved.

## Active database cleanup

| Entity | Removed from active tables | Retained active |
| --- | ---: | ---: |
| Confirmed dummy customer masters | 9 | 2,142 genuine/workbook/connector masters |
| Seeded demo visits | 3 | 14 existing visits |
| Seeded demo expected order | 1 | 8 existing orders |
| Generated Excel invoice projections | 23,620 | 8,294 connector-sourced invoices |
| Lines belonging to those projections | 24,482 | 19,198 connector invoice lines |

Nine existing user activity rows (four visits, three calls/customer activities, one expected order and one service request) were preserved and relinked to unique exact-name Tally-imported customer records. No fuzzy identity match was used, and no seeded ownership or balances were copied onto genuine customers.

The 23,620 removed invoice rows were manufactured by the old workbook importer, identified by their `excel-import` source, exact generated references and synthetic GUID pattern. Genuine workbook monthly aggregates and supplied historical report files were preserved. Ordinary authoritative sales queries already excluded those invoice projections.

**Reversibility:** 48,124 original row snapshots were archived in `crm_dummy_cleanup_archive` (48,115 removed rows plus nine before/after relink snapshots). Run ID: `2010695a-b09a-4d33-a76e-b122d02c5975`.

Verified pre-cleanup backup: `data/crm-before-dummy-removal-2026-11-20-verified.sqlite`. A first backup also remains at `data/crm-before-dummy-removal-2026-11-20.sqlite`, created before an initial safety-check rollback. Both are ignored by Git. These backup/archive records are retained historical material, not queried as active CRM data. Restoring a full backup later requires care to preserve work created after cleanup; no automatic restore was performed.

## Preservation evidence

Row-value comparisons against the verified backup show all 8,294 genuine invoices, 19,198 genuine lines, 156 targets, 39 profiles, 39 users, 14,588 products, 13,994 payments and 2,142 non-dummy customer masters unchanged. All six historical/aggregate datasets were also identical: customer monthly sales, product monthly sales, RM product history, historical RM performance, weekly purchases and party-payment history.

Active checks returned zero known dummy customers, demo visits/orders, webinar/sample masters and generated/mock invoices. Re-running the cleanup in dry-run mode returned ?No known dummy data found?.

The old generated invoice lines contained 4,536 pre-existing invalid product references. Removing those synthetic rows reduced foreign-key violations to zero. Both the backup and cleaned database passed `PRAGMA integrity_check`.

See [cleanup manifest](cleanup-result.json) and [preservation proof](data-preservation.json).

## Code changes

- The current RM/Admin report workspace consumes the API report directly; unconditional snapshot filling and simulated preview transformations are disconnected.
- Invented summary values (previous sales/growth/follow-ups), generated monthly/weekly observations, fabricated saved entries and synthetic thrust metrics no longer populate operational reports.
- The two retired compatibility helper modules return the actual input unchanged; operational imports/callers of their generators are absent. Actual report preview/PDF download and the existing responsive layout remain.
- Normal server startup no longer invokes webinar demo seeding.
- Five seed/sample scripts and the webinar fixture helper require explicit isolated temporary fixture settings before opening/importing a database. They refuse the ordinary CRM database.
- Workbook import no longer manufactures invoices, seeds visits/orders, provisions accounts, resets credentials or replaces existing ownership. It upserts genuine supplied source keys without wholesale clearing; blank values preserve existing records, while explicit zeros and negative values are imported correctly.
- `db:setup` runs migrations only. Missing-database bootstrap no longer silently restores the bundled historical baseline. Explicit approved restores remain possible and documented.
- The cleanup utility is dry-run-first, requires an explicit database and separate new backup file for apply, reserves that filename exclusively, archives every changed row, rejects ambiguous customer matches and unknown dependents, preserves logical links even where SQLite FKs are undeclared, and rolls back atomically on failures.

Main changed files: `scripts/remove-dummy-data.mjs`, its tests, `server/fixture-data-guard.mjs`, `server/app.mjs`, `server/db.mjs`, `server/webinar-demo.mjs`, seed/sample scripts, `scripts/import_psspldata.py`, `package.json`, `README.md`, `src/components/admin/rm-performance-workspace.tsx`, `src/components/reports/rm-performance-view.tsx`, `rm-thrust-products.tsx`, and the two retired helper modules/types. Previous uncommitted responsive work was preserved.

## Verification

- Production build passed after quarantining an invalid generated OneDrive build cache within the workspace. The initial EINVAL/readlink cache failure did not require a product-code workaround.
- TypeScript passed: `tsc --noEmit --incremental false`.
- Main Node suite: 45 passed, zero failures, one opt-in browser case skipped in that invocation.
- Explicit browser/integration run: 7 passed, including real API-projection rendering, absent fake preview controls, recorded attendance/products/entries, responsive widths, drill-down and downloaded PDF.
- Additional report/history regression suite: 20 passed, zero failures, four optional browser cases skipped.
- Python workbook-import integration test passed, covering real source import, credential/ownership/activity preservation, empty/partial input, blank/zero/negative cells and existing target/history preservation.
- Eight cleanup tests passed, including ambiguous mappings, undeclared references, retained real rows, idempotence, backup integrity and forced mid-transaction rollback.
- Independent review found and prompted fixes for dormant-reason/product logical links, backup races, broad importer clearing and explicit-zero imports. These fixes were verified before completion.

Logs: [build](build-final.log), [main tests](tests.log), [browser/PDF tests](browser-tests.log), [report regressions](report-regression-tests.log), [importer test](importer-test.log), [cleanup tests](cleanup-tests.log), [TypeScript](typescript.log).

## Scope and remaining limits

- The active CRM reads SQLite. Supabase is an outbound secondary mirror. Its read-only verification failed TLS validation (`SELF_SIGNED_CERT_IN_CHAIN`); remote dummy counts/deletions remain unverified. TLS was not weakened and no remote writes were performed. Its existing upsert-only replication does not propagate deletions.
- Tally's configured data sync remains hourly, with a minute heartbeat. This cleanup does not turn it into second-by-second live fetching or fabricate newer transactions.
- Genuine supplied historical reports, CRM-managed targets and real records remain. Broader audit findings such as company scoping, voucher lifecycle handling and target-source normalization require their own implementation stages.
- No deployment, push or commit was performed. Changes remain in the current checkout; the local database cleanup was actually applied.
- An optional temporary test-fixture folder removal was rejected by automatic approval review with the stated reason ?blocked by policy?. It was not retried and has no bearing on the successfully completed CRM cleanup.
