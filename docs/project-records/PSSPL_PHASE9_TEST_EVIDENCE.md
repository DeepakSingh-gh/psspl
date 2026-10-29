# PSSPL Phase 9 Test Evidence

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

All test and build work used isolated synthetic SQLite data with outbound providers blocked or mocked. The normal development process was stopped before this work and was not restarted against its existing database.

Run date: 2026-10-18. Isolated automated suites: 83 test cases passed, 0 failed. TypeScript: passed. Next production build in a temporary source copy: passed; Inter Google font import was removed only in that disposable copy to avoid external font network access. Browser automation: BLOCKED (no browser surfaces available; see [browser status](../uat/phase9/browser-status.md)).

| Suite | Result | Passed | Failed | Evidence |
|---|---:|---:|---:|---|
| phase1-security | PASS | 10 | 0 | [phase1-security.log](../uat/phase9/phase1-security.log) |
| phase2-tally-accuracy | PASS | 6 | 0 | [phase2-tally-accuracy.log](../uat/phase9/phase2-tally-accuracy.log) |
| phase3-rm-report | PASS | 4 | 0 | [phase3-rm-report.log](../uat/phase9/phase3-rm-report.log) |
| phase4-management | PASS | 8 | 0 | [phase4-management.log](../uat/phase9/phase4-management.log) |
| phase5-field-workflows | PASS | 5 | 0 | [phase5-field-workflows.log](../uat/phase9/phase5-field-workflows.log) |
| phase6-leads | PASS | 2 | 0 | [phase6-leads.log](../uat/phase9/phase6-leads.log) |
| phase6-reports | PASS | 2 | 0 | [phase6-reports.log](../uat/phase9/phase6-reports.log) |
| phase7-automation | PASS | 19 | 0 | [phase7-automation.log](../uat/phase9/phase7-automation.log) |
| ai-provider | PASS | 7 | 0 | [ai-provider.log](../uat/phase9/ai-provider.log) |
| attendance-live | PASS | 5 | 0 | [attendance-live.log](../uat/phase9/attendance-live.log) |
| phase8-workflows | PASS | 8 | 0 | [phase8-workflows.log](../uat/phase9/phase8-workflows.log) |
| phase9-recovery | PASS | 7 | 0 | [phase9-recovery.log](../uat/phase9/phase9-recovery.log) |
| phase6-my-day | PASS | - | 0 | [phase6-my-day.log](../uat/phase9/phase6-my-day.log) |
| typescript | PASS | - | 0 | [typescript.log](../uat/phase9/typescript.log) |
| Phase 6 My Day standalone | PASS (HTTP 200) | - | 0 | [phase6-my-day.log](../uat/phase9/phase6-my-day.log) |
| TypeScript | PASS | - | 0 | [typescript.log](../uat/phase9/typescript.log) |
| Production build | PASS | - | 0 | [build.log](../uat/phase9/build.log) |
| Initial preservation audit | PASS | - | 0 | [preservation.json](../uat/phase9/preservation.json) |

The initial preservation audit covered 249 pre-existing files: 23 intended implementation/test files changed, with no changes to the five protected environment/database files. The [isolated test-run snapshot](../uat/phase9/results.json) independently reports no files changed during the run.

The original Phase 8 reproduction is retained at [pre-fix-reproduction.log](../uat/phase9/pre-fix-reproduction.log); it demonstrates the missing-column failure before the new migration. Phase 8 UAT reports and evidence were not overwritten.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
