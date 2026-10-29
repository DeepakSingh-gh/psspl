# PSSPL Phase 9 execution plan

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Date: 18 October 2026 (Asia/Kolkata). Branch: `feature/psspl-phase3-rm-report-cards`.

The Phase 8 baseline has 142 requirements: 28 completed, 103 partial, 5 missing, 1 broken and 5 unverified. Final UAT failed. This phase repairs reproduced defects and recovers safe implementation gaps without inventing business rules or accepting unexecuted browser/provider workflows.

1. **Protect the existing workspace.** Pause the normal project development/watch session before changing backend/schema files. Hash original files and database/configuration inputs. Preserve unrelated uncommitted changes, credentials and environment files. Use disposable synthetic databases, temporary audio storage and mocked integrations. Leave normal startup stopped because it can apply migrations to existing data.
2. **P0: clean initialization/My Day/C20.** Reproduce Phase 8's fresh-schema failure first. Add backward-compatible, recorded, additive schema recovery for missing profile metadata, retaining existing populated values and rejecting unexpected migration errors. Remove test-only schema shims and assert real login/My Day/attendance/visit workflows on unmodified fresh initialization. Check migration repeatability, legacy schemas and rollback.
3. **P1: India business dates.** Use one host-independent Asia/Kolkata calendar implementation for report defaults/presets and financial/current-day boundaries. Preserve UTC instant storage. Check daily, rolling seven-day, monthly, previous-month, FY, year-end/leap-day and custom ranges, including actual report records at both boundaries. Label rolling weeks explicitly; do not invent a business week-start policy.
4. **Safe requirement recovery.** Remove artificial customer-list truncation while retaining owner/team scope. Make filtered report print/PDF include complete aggregate rows, without changing export format or accounting rules. Verify authorized records, all filtered rows and explicit unavailable states. Other gaps needing approved origins, GPS/geofences, mandatory logging, translation, pipeline policy, consent or live data remain blocked.
5. **Regression/security/build.** Run existing suites and new migration/date/workflow/access tests with real outbound networking blocked. Type-check and build an environment-free temporary source copy, with real providers disabled; never load the client baseline or .env into build verification. Check browser-tool availability and label unavailable desktop/mobile cases BLOCKED. Inspect diffs and preservation hashes.
6. **Reconcile and deliver.** Review every original requirement and split working implementation from missing functionality, configuration/integration/testing and business approval. Publish Phase 9 implementation report, full 142-row matrix, test evidence, remaining blockers and Phase 10 readiness. Preserve Phase 8 results as historical evidence. Do not deploy, commit, push or begin Phase 10 automatically.

Acceptance: P0 must pass without fixture alterations; tests must not preserve expected failures after fixes. Formal UAT remains pending where browser/device/live-data/provider/client acceptance cannot be executed. External-access or business-decision blockers are recorded with owners and concrete next steps.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
