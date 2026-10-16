# My Day loading performance — 16 October 2026

## Scope

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

## Deployment and remaining hosting latency

Render API inspection confirmed `psspl-crm-backend` runs one Free instance. A live health request returned HTTP 200 in 1,437 ms; this was not a cold-start test. According to [Render documentation](https://render.com/docs/free#spinning-down-on-idle), Free services spin down after 15 idle minutes and can take about one minute to start again. Query optimization and compression do not remove that hosting delay.

These changes are local and require code deployment to affect Vercel/Render. No production restart, plan change or deployment was performed in this task. Before any production deployment, preserve the live SQLite database and confirm the recovery path: [Render Free uses an ephemeral filesystem](https://render.com/docs/free#local-files-lost-on-redeploy). An always-on hosting change is separate work with cost and persistence implications.
