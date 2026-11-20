# Pipeline Synchronization Implementation Plan

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](../../operations/2026-11-20-current-state.md); [automatic pipeline synchronization](../../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](../../operations/check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

> Use superpowers:executing-plans for inline implementation and superpowers:test-driven-development for the regression cycle.

**Goal:** Saved pipeline changes automatically appear in authorized active sessions without a page refresh.

**Architecture:** Transactional SQLite owner revisions, authenticated SSE invalidations and targeted sequential client refetches.

**Tech stack:** Existing Node/Express/SQLite, Next/React, native fetch streams; no added dependencies.

**Spec:** [Design](../specs/2026-11-20-pipeline-sync-design.md).

## Constraints and review focus

Preserve the current working tree, layouts, stages, API permission rules and business records. Check rollback visibility, assignment scope loss, revoked sessions, concurrent refresh ordering and reconnect gaps. Tests use isolated temporary databases; do not seed the active database.

- [x] Add failing regression tests for revisions, scoped summary and authenticated SSE.
- [x] Add migrations 017/018, scoped SSE/summary router, and wire it into the existing API.
- [x] Add tested shared streaming/reconnect/coalescing client and targeted component subscriptions.
- [x] Verify separate sessions, concurrent updates, reconnect and stable browser UI.
- [x] Run pipeline regressions, TypeScript/build, review the diff and record evidence/limits.

Completed locally with scoped SSE, selective pipeline reads, automatic read retries, separate-browser coverage and passing build/type checks. See [verification report](../../uat/pipeline-sync-2026-11-20/report.md). No commit or deployment.
