# PSSPL Project Records

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

<!-- oct27-ui-details:start -->
## Latest 27 October implementation record

[Overview cleanup, Pipeline presentation and RM top-sales dashboard/PDF](../operations/2026-10-27-ui-adjustments.md#overview-pipeline-and-rm-ranking-updates) records exact scope, source rules, reconciliation findings and dated verification. Earlier release/UAT records are not new approval or deployment evidence.


Latest follow-up: [Local preview and RM dashboard scope](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup): **Start Preview / Exit Preview** controls optional Rais Khan sample rows. Empty products receive five examples; a short customer list keeps real rows and appends marked samples to five. Sample customer shares are unavailable and totals remain recorded values. Dashboard/PDF labels match; no persistence occurs. The bottom Monthly target card is hidden for RM accounts only, with the salesperson card retained.
<!-- oct27-ui-details:end -->

Project verification, requirements, UAT, client approval, and delivery records are grouped here.

## Current implementation references

- [26 October Admin chart and sidebar changes](../operations/admin-product-trends-and-sidebar.md): native light-theme chart, source-backed historical recovery, explicitly labeled MoM fallback, observation-window lifecycle, unresolved voucher-header variance, preserved interactions and sidebar-only Reporting removal. The guide distinguishes recorded 22-test validation from deployment/client acceptance.

- [Current source summary](../operations/2026-10-21-current-state.md): current account creation, email delivery, restoration, location-map behavior and remaining release limits.
- [Gmail SMTP and professional employee emails](../operations/gmail-smtp-authentication.md): verified password inclusion, all employee fields, admin actions, queue controls, local/remote access and recorded validation.
- [Supplied RM snapshots and percentage review](../operations/rm-feedback-snapshots.md): all 12 source reports, preserved UI, ranking, denominator examples and requested local account cleanup.
- [Claude AI operations](../operations/claude-ai.md): backend configuration, evidence-bound recommendations, failure behavior and recorded validation.
- [Migration inventory](../../database/migrations/README.md): provider pinning (013) and preserving queue/delivery rows when adding account notices (014).

The project records below remain dated verification and approval evidence. This documentation update does not turn old test results into a new production sign-off.

## Final UAT and client sign-off

- [PSSPL_CLIENT_APPROVAL_CHECKLIST.md](./PSSPL_CLIENT_APPROVAL_CHECKLIST.md)
- [PSSPL_CLIENT_DECISION_REGISTER.md](./PSSPL_CLIENT_DECISION_REGISTER.md)
- [PSSPL_FINAL_CLIENT_UAT_CHECKLIST.md](./PSSPL_FINAL_CLIENT_UAT_CHECKLIST.md)
- [PSSPL_FINAL_COMPLETION_REPORT.md](./PSSPL_FINAL_COMPLETION_REPORT.md)
- [PSSPL_FINAL_UAT_REPORT.md](./PSSPL_FINAL_UAT_REPORT.md)
- [PSSPL_FINAL_UAT_REQUIREMENTS_MATRIX.md](./PSSPL_FINAL_UAT_REQUIREMENTS_MATRIX.md)
- [PSSPL_LIVE_INTEGRATION_UAT_PLAN.md](./PSSPL_LIVE_INTEGRATION_UAT_PLAN.md)

## Phase verification and delivery reports

- [PSSPL_PHASE10_GO_NO_GO.md](./PSSPL_PHASE10_GO_NO_GO.md)
- [PSSPL_PHASE10_GO_NO_GO_UPDATED.md](./PSSPL_PHASE10_GO_NO_GO_UPDATED.md)
- [PSSPL_PHASE10_READINESS.md](./PSSPL_PHASE10_READINESS.md)
- [PSSPL_PHASE1_VERIFICATION.md](./PSSPL_PHASE1_VERIFICATION.md)
- [PSSPL_PHASE2_VERIFICATION.md](./PSSPL_PHASE2_VERIFICATION.md)
- [PSSPL_PHASE3_VERIFICATION.md](./PSSPL_PHASE3_VERIFICATION.md)
- [PSSPL_PHASE4_VERIFICATION.md](./PSSPL_PHASE4_VERIFICATION.md)
- [PSSPL_PHASE5_VERIFICATION.md](./PSSPL_PHASE5_VERIFICATION.md)
- [PSSPL_PHASE6_VERIFICATION.md](./PSSPL_PHASE6_VERIFICATION.md)
- [PSSPL_PHASE7_VERIFICATION.md](./PSSPL_PHASE7_VERIFICATION.md)
- [PSSPL_PHASE8_IMPLEMENTATION_PLAN.md](./PSSPL_PHASE8_IMPLEMENTATION_PLAN.md)
- [PSSPL_PHASE9B_BROWSER_TEST_REPORT.md](./PSSPL_PHASE9B_BROWSER_TEST_REPORT.md)
- [PSSPL_PHASE9B_EXECUTION_BACKLOG.md](./PSSPL_PHASE9B_EXECUTION_BACKLOG.md)
- [PSSPL_PHASE9B_IMPLEMENTATION_REPORT.md](./PSSPL_PHASE9B_IMPLEMENTATION_REPORT.md)
- [PSSPL_PHASE9B_INTEGRATION_EVIDENCE.md](./PSSPL_PHASE9B_INTEGRATION_EVIDENCE.md)
- [PSSPL_PHASE9B_REQUIREMENTS_MATRIX.md](./PSSPL_PHASE9B_REQUIREMENTS_MATRIX.md)
- [PSSPL_PHASE9C_IMPLEMENTATION_REPORT.md](./PSSPL_PHASE9C_IMPLEMENTATION_REPORT.md)
- [PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md](./PSSPL_PHASE9C_REQUIREMENTS_MATRIX.md)
- [PSSPL_PHASE9_EXECUTION_PLAN.md](./PSSPL_PHASE9_EXECUTION_PLAN.md)
- [PSSPL_PHASE9_IMPLEMENTATION_REPORT.md](./PSSPL_PHASE9_IMPLEMENTATION_REPORT.md)
- [PSSPL_PHASE9_REMAINING_BLOCKERS.md](./PSSPL_PHASE9_REMAINING_BLOCKERS.md)
- [PSSPL_PHASE9_REQUIREMENTS_MATRIX.md](./PSSPL_PHASE9_REQUIREMENTS_MATRIX.md)
- [PSSPL_PHASE9_TEST_EVIDENCE.md](./PSSPL_PHASE9_TEST_EVIDENCE.md)

## Requirements audit

- [PSSPL_REQUIREMENTS_AUDIT.md](./PSSPL_REQUIREMENTS_AUDIT.md)
- [PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md](./PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md)
- [PSSPL_REQUIREMENTS_AUDIT_FINDINGS.md](./PSSPL_REQUIREMENTS_AUDIT_FINDINGS.md)
- [PSSPL_REQUIREMENTS_AUDIT_MATRIX.md](./PSSPL_REQUIREMENTS_AUDIT_MATRIX.md)
- [PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md](./PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md)
- [PSSPL_REQUIREMENTS_AUDIT_ROADMAP_1.md](./PSSPL_REQUIREMENTS_AUDIT_ROADMAP_1.md)
- [PSSPL_REQUIREMENTS_AUDIT_ROADMAP_2.md](./PSSPL_REQUIREMENTS_AUDIT_ROADMAP_2.md)

## Guides and architecture notes

- [ARCHITECTURE_CONTINUED.md](./ARCHITECTURE_CONTINUED.md)
- [README_GUIDE_CONTINUED.md](./README_GUIDE_CONTINUED.md)


## Current operations guides

- [Current implementation summary - 21 October](../operations/2026-10-21-current-state.md)
- [Archived Employees](../operations/archived-employees.md)
- [Team structure](../operations/team-structure.md)
- [Authentication workflow report](../superpowers/reports/2026-10-20-authentication-workflow.md)

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
