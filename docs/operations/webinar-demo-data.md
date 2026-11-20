# Webinar fixtures (isolated tests only)

<!-- current-local-status-2026-11-20:start -->
> **Current local status - 20 November 2026:** [Database, cleanup and four verified RM logins](2026-11-20-current-state.md); [automatic pipeline synchronization](../uat/pipeline-sync-2026-11-20/report.md); [GPS, checkout and phone HTTPS requirements](check-in-location.md). Trusted phone HTTPS and the self-hosted address endpoint remain pending. Earlier dated behavior/results below remain historical where superseded; local work does not establish production deployment.
<!-- current-local-status-2026-11-20:end -->

Normal API startup no longer seeds webinar data. `CRM_ENABLE_WEBINAR_DEMO_DATA=true` does not enable it. Do not redeploy or restore the bundled baseline to add/remove samples in an operational database.

The retained `server/webinar-demo.mjs` helper can be invoked explicitly only against a disposable fixture connection matching all four settings:

- `NODE_ENV=test`
- `CRM_FIXTURE_DATABASE=true`
- `CRM_TEST_DATABASE_ROOT`: an existing dedicated directory strictly below the operating system temporary directory
- `CRM_DATABASE_PATH`: a database strictly inside that root

The guard rejects ordinary CRM paths and symlink/junction escapes and disables baseline restoration. Never copy a live database into the fixture directory for seeding. Fixture sales may affect fixture totals and must not be presented as actual business data.

Known fixtures were removed from the active local database on 20 November 2026 with a separate backup and archived row snapshots. For another reviewed database, use `scripts/remove-dummy-data.mjs --database <path>` for a dry run. Applying changes requires an explicit `--apply --backup <new-path>`; the tool refuses existing backup destinations and ambiguous mappings. Do not run broad ID-pattern SQL deletes.

See [current status](2026-11-20-current-state.md) and [cleanup evidence](../uat/dummy-removal-2026-11-20/report.md). Remote mirrors and deployed databases were not cleaned by this local operation.
