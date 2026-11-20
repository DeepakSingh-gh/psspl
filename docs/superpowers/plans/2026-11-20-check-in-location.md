# Check-in Location Implementation Plan

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

> Execute inline with superpowers:executing-plans and test-driven regression checks.

**Goal:** Accurate immutable check-in evidence with truthful address/accuracy display and automatic Admin updates.

**Architecture:** Reuse attendance/self authentication/Admin map/attendance revision monitor; add capture metadata and a guarded optional server-side reverse geocoder.

**Spec:** [Design](../specs/2026-11-20-check-in-location-design.md).

- [x] Add failing isolated regressions for capture, historical storage, duplicate saves and geocoding.
- [x] Add nullable migration and fix transactional recordDailyCheckIn; wire asynchronous saved-record address resolution.
- [x] Fix click-only high-accuracy frontend capture, explicit failure/coarse-fix choices and remove automatic background watches.
- [x] Fix Admin/current/history APIs and map display to use original attendance evidence; refresh on address updates.
- [x] Run mocked browser/backend regressions, TypeScript/build, independent review and document provider/manual-device limits.
