# Release status - 20 November 2026

The user authorized publishing the current CRM updates to GitHub, Vercel and Render. Deployment credentials were read locally from the specifically requested `.env` lines: Vercel 37, Render 42, GitHub 59. Their values are not included in source, reports or command output; `.env` remains ignored.

## Source and validation

The release includes responsive UI work, retirement of synthetic business/report data, fixture/import safeguards, pipeline synchronization, original check-in GPS metadata/address support, phone HTTPS diagnostics, correct checkout states and updated documentation. Local data cleanup is not a migration of the separate live Render database.

The release unit/HTTP regression run passed **268 tests, zero failures, seven optional cases skipped**. The workbook import integration test passed. TypeScript, production build and dedicated pipeline/GPS browser checks passed in the implementation verification. The minimal visit-link migration fixture now tests migration 016 in isolation, instead of trying to apply unrelated future profile/attendance migrations to an intentionally partial schema.

A broad legacy browser attempt did not produce a green suite: development-server navigation timeouts, inherited test-root assumptions and pre-removal snapshot baselines were encountered. It was not treated as successful verification. Relevant changed-feature browser scenarios were verified separately against a production build using isolated databases and mocked GPS/provider responses. Real-device GPS and the deferred self-hosted Nominatim endpoint remain unverified.

The GitHub repository is public. Verified account passwords, `.env`, databases/backups, deployment helpers and raw local UAT captures/exports are excluded from the release. Markdown documentation retains sanitized summaries and references local evidence. Publishing source does not copy local users/passwords or business data into the remote database.

## Render rollout hold

The existing `psspl-crm-backend` service is still on the **Free** plan with SQLite at `./data/crm.sqlite` and no persistent disk. Authenticated read-only checks confirmed that the runtime contains live user/activity records. The backend health endpoint was HTTP 200.

Render automatic deployment was temporarily switched from `commit` to `off` before publishing source, to prevent a Git push from replacing the live ephemeral filesystem. The current runtime was not redeployed, cleared or migrated. The existing production frontend should remain on the matching old backend until a safe coordinated rollout is possible; new frontend code can be reviewed through a Vercel deployment.

Render documents that [ephemeral local files are lost on deploy/restart](https://render.com/docs/disks) and that [Free services lack persistent disks and shell access](https://render.com/docs/free). The current application does not expose a complete authenticated raw-SQLite backup endpoint. No supported lossless backup/restore path for the running instance was verified. A local SQLite backup or a partial HTTP export is not a full backup of this separate live database.

**Remaining decision:** provide a current complete live SQLite backup with an approved restore path, or explicitly authorize replacing remote data with the reviewed cleaned local database. The latter is a data migration/reset decision, not implied by publishing code. Upgrading/changing a running service must also be planned for filesystem preservation; it is not assumed to recover the existing ephemeral file safely.

Until that decision is resolved, Render auto-deploy remains held and no production backend rollout is claimed. Actual Git commit/deployment IDs and the Vercel review URL are reported after the API operations complete. No keys or full database exports are published.
