# My Day loading performance — 16 October 2026

## Scope

**Status update, 16 October 2026:** Performance code was committed to `DeepakSingh-gh/psspl` in `e17852a`; subsequent frontend releases include `6c585c1` (RM landing) and `87eae1e` (report tabs). Vercel publication is complete, but the backend query and compression changes have not been rolled out to Render. This report's measurements remain local results. This documentation refresh is local only.

Reduce `/sales/my-day` loading work while preserving records, API fields, reference lists, authorization and existing workflows. Prior sign-in and Ask AI changes in the workspace remain intact.

## Findings and implementation

- The previous product aggregate began with all active invoices before applying the customer scope. A customer-ID subquery allows existing indexes to filter invoices before joining their lines.
- The My Day builder repeatedly reconstructed the RM alias directory. It now shares one directory within the request; there is no stale cross-request cache.
- The complete product reference list contains 14,547 rows locally and contributes approximately 2.38 MB before compression. Standard Express compression reduces transfer size without truncating rows or fields.
- Sales sidebar navigation now uses Next.js links rather than forcing full document reloads.

## Validation

| Check | Result |
| --- | --- |
| Legacy versus optimized product aggregates | Passed for 25 scopes, including a nonexistent user |
| Top product names, sales values and quantities | Matched; numeric tolerance below 0.01 for aggregation order |
| Request-local versus default customer/target scope | Matched for three representative users |
| Aggregate legacy query duration | 3,980 ms total |
| Aggregate optimized overview duration | 161 ms total; approximately 24.7 times faster for this workload |
| RM My Day response | 2,396,506 bytes uncompressed; 410,012 bytes gzip |
| Salesperson My Day response | 2,397,335 bytes uncompressed; 410,450 bytes gzip |
| Decoded compressed versus uncompressed JSON | Exactly equal for both roles |
| No-session request | HTTP 401 |
| Compression negotiation | Identity and gzip both HTTP 200; gzip encoding and Vary verified |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` passed |
| Existing AI provider checks | Six checks passed |
| Whitespace checks | `git diff --check` passed |

Timings were measured locally on the existing SQLite ledger. They measure selected backend work and response transfers, not live end-to-end browser performance. The first isolated query comparison was approximately 486 ms versus 38 ms. No financial rows are printed by the verification scripts. HTTP test sessions are removed in a finally block.

## Reproduce

```powershell
node scripts/verify-my-day-performance.mjs
# With the local API running on port 4000:
node scripts/verify-my-day-http.mjs
node node_modules/typescript/bin/tsc --noEmit
node --test scripts/ai-provider.test.mjs
git diff --check
```

## Local attendance freshness follow-up

The Admin attendance delay was also caused by one-time client fetching: mounted views did not automatically revalidate after another user's clock-in/out. A new admin-only, non-cacheable attendance-revision endpoint fingerprints the current day's persisted records. Relevant admin views share a two-second visible-tab poll and refresh their cached data only when that fingerprint changes, retaining tabs/filters. Hidden tabs skip network checks; focus/reconnect checks immediately, with non-overlap, timeout and unsubscribe cleanup.

Validation: five monitor/revision tests passed. An isolated database-snapshot HTTP check verified actual check-in and check-out routes, immediate Admin activity visibility (12 ms revision/activity fetch), canonical RM detail check-out visibility (234 ms combined verification), stable unchanged revisions, no-store headers and HTTP 401/403 authorization. Original attendance was not modified. TypeScript passed. These are local API measurements, not browser end-to-end guarantees; normal visible-page detection adds up to about two seconds plus request time. Reproduce with `node --test scripts/attendance-live.test.mjs` and `node scripts/verify-attendance-latency.mjs`.

This follow-up is local only. A future release needs both the new backend endpoint and subscribing frontend; the deployed app will not gain automatic attendance updates from these uncommitted edits.

## Hosting and earlier release status

Render API inspection confirmed `psspl-crm-backend` runs one Free instance. A live health request returned HTTP 200 in 1,437 ms; this was not a cold-start test. According to [Render documentation](https://render.com/docs/free#spinning-down-on-idle), Free services spin down after 15 idle minutes and can take about one minute to start again. Query optimization and compression do not remove that hosting delay.

The frontend changes have been deployed to Vercel and the complete source has been pushed to GitHub. Backend query/compression improvements remain pending on Render; frontend publication alone does not activate them. Render's automatic deploy trigger was temporarily paused around GitHub pushes and restored afterward, without requesting a backend deployment. Preserve the live SQLite database and confirm the recovery path before a backend rollout: [Render Free uses an ephemeral filesystem](https://render.com/docs/free#local-files-lost-on-redeploy). An always-on hosting change is separate work with cost and persistence implications.

## Latest local follow-up ? 16 October 2026

The latest pending local attendance fix addresses one-time Admin data fetching, separately from the earlier My Day query/transfer optimization. Relevant Admin views share a two-second revision monitor and refetch only after persisted attendance changes. Actual delay includes polling plus API/network time.

The manual refresh button is hidden on login/root routes and printed output. Automatic attendance refresh does not reload the document or reset tabs/filters.

Sales Reports zero totals for 1?16 October were explained by local invoice coverage: latest invoice `2026-09-08`, 78 September invoices, no October invoices in the selected range. Attendance polling cannot supply missing Tally invoices; no report query/data modification was needed.

The earlier test results remain local measurements. Pending refresh/attendance code and this Markdown update have not been published; last verified frontend commit remains `87eae1e`.

Release context: [source synchronization and deployment status](./2026-10-16-production-source-sync.md).

> Current project status (19 October 2026): See the [production readiness report](../../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for the latest verified work and blockers; earlier findings in this document retain their original date.
