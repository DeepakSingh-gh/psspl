# PSSPL Phase 9B Integration Evidence

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

All verification used synthetic records, mocks, loopback-only services or source/build checks. No production data or actual customer communications were used.

| Area | Verification | Result / remaining limit | Evidence |
|---|---|---|---|
| Tally connector/reporting | Phase 2 accuracy/attribution fixtures and Phase 6 report endpoint tests; browser report used synthetic invoice rows. | Synthetic aggregation/filtering passed. No live Tally connection, customer master, accounting ledger or production sync was contacted. | [phase2 log](../uat/phase9/phase2-tally-accuracy.log); [phase6 report log](../uat/phase9/phase6-reports.log); [browser report](./PSSPL_PHASE9B_BROWSER_TEST_REPORT.md) |
| WhatsApp | Phase 7 mock sender, approval/opt-in checks, signed webhook and delivery state tests. | Simulated sender only; no phone numbers, templates or messages were delivered. Live provider credentials/sandbox authorization remain required. | [phase7 log](../uat/phase9/phase7-automation.log) |
| Notifications/scheduled reports | Phase 7 scheduler, persistence, retry and notification payload fixtures. | Synthetic scheduler and callback behavior passed. No production cadence, recipient or channel approval. | [phase7 log](../uat/phase9/phase7-automation.log) |
| Ask AI and speech | Phase 7 and AI-provider tests use mocked fetch/provider responses; Phase 8 verifies mocked authenticated speech upload/transcription. | Grounding/scope/error paths passed under mocks. No real provider request, language accuracy or translation claim. | [AI log](../uat/phase9/ai-provider.log); [Phase 7 log](../uat/phase9/phase7-automation.log); [Phase 8 log](../uat/phase9/phase8-workflows.log) |
| Reports | Phase 6 API fixtures plus Playwright browser filter, download and print checks. | North filter, CSV/XLS downloads and browser-generated PDF passed on synthetic report rows. Real Tally reconciliation and client sign-off remain. | [Phase 6 report log](../uat/phase9/phase6-reports.log); [browser artifacts](../uat/phase9b) |
| Role workflows | Phase 1/P8 API authorization plus Playwright admin, RM and salesperson login/navigation. | Synthetic role routes and UI loads passed. Production identities, deployment TLS, full device matrix and client role map remain. | [security log](../uat/phase9/phase1-security.log); [workflow log](../uat/phase9/phase8-workflows.log); [browser report](./PSSPL_PHASE9B_BROWSER_TEST_REPORT.md) |
| Dependencies/security | npm audit after semver-compatible patches/override. | Zero known advisories at verification time; future dependency state may change. | `npm audit --json` returned total 0. |

## External verification gates

Live Tally access, WhatsApp delivery, client-region/customer mapping, supported speech languages, transcription translation, GPS/geofence, customer-origin history and production privacy/legal controls require authorized sandboxes or owner approval. These were not marked passed.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
