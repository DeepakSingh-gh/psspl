# PSSPL Phase 9B Browser Test Report

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Result: PASS (2 tests; 0 failures).

## Browser coverage

Playwright ^1.64.1 with Chromium was run against a production build in a disposable source copy. Desktop viewport: 1440x960. Mobile browser viewport simulation: 390x844 with touch emulation. These are browser viewport simulations, not physical-device results. All external browser hosts were blocked; only loopback app/API requests were permitted.

Covered: admin dashboard and Reports navigation; North region filter with an expected synthetic total of INR 900 (South row INR 5,000 excluded); CSV/XLS downloads; browser PDF generation; RM team view; salesperson My Day; call-form required-field validation; visit customer picker; mobile My Day/customer hub navigation and horizontal overflow checks. Browser test result: 2 passed, 0 failed.

Screenshots and generated report artifacts are in docs/uat/phase9b/. Physical Android/iOS devices, GPS permissions, microphone recording, real-world geolocation accuracy and different mobile browsers were not tested.

## Evidence index

- E-P9B-01: both Playwright tests passed, covering admin/RM/salesperson roles and desktop/mobile browser viewports.
- E-P9B-02: North filter produces INR 900 and excludes the South-owned INR 5,000 synthetic sale; see admin report screenshot and downloaded report files.
- E-P9B-03: CSV and XLS downloads plus non-empty browser-generated PDF from the filtered report.
- E-P9B-04: 106 assigned customers rendered on the mobile viewport and assigned customer selected in the visit form.

## Evidence files

- Regression output: [phase9b-browser.log](../uat/phase9/phase9b-browser.log)
- Temporary Next production build: [build.log](../uat/phase9b/build.log)
- Desktop and mobile screenshots, downloaded CSV/XLS and generated PDF: [docs/uat/phase9b](../uat/phase9b)
- Server/API logs: [server.log](../uat/phase9b/server.log)
- Dependency audit: [dependency-audit.json](../uat/phase9b/dependency-audit.json)
- Preservation: [preservation.json](../uat/phase9b/preservation.json)

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
