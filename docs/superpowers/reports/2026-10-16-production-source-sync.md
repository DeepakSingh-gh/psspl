# Production source synchronization — 16 October 2026

## Source audit

The working PC checkout was on `khushi`, tracking `Khushi-Bizgenix/psspl`. The user's repository is `DeepakSingh-gh/psspl`, with production branch `main`. Both repositories shared base commit `c8fb489243ba978a394af8409322b7dce5b5fe97` at the audit; the PC additionally contained uncommitted sign-in, Ask AI and performance fixes.

Vercel project `psspl-crm` had no persistent Git link reported by its API, and its latest production deployment metadata referred to `Khushi-Bizgenix/psspl`, branch `khushi`. Render already watched `DeepakSingh-gh/psspl`, branch `main`, with automatic deploys enabled.

## Release contents and validation

The local source is the release source: API routing fixes, backend AI provider configuration/error handling, My Day query optimization, response compression, sales navigation improvements, regression checks and accompanying Markdown documentation. API keys remain in local/hosting configuration, excluded from source control.

The production build completed successfully for all 27 pages, with one existing CSS autoprefixer warning. Provider checks, TypeScript, 25-scope ledger comparisons, authenticated RM/salesperson compression checks and whitespace checks passed.

## Deployment boundaries

GitHub synchronization and Vercel frontend publication do not copy or merge local and live databases. The frontend continues to call the existing Render API. Render's Free service has an ephemeral SQLite filesystem, so its automatic deploy trigger must be temporarily paused during the GitHub push to prevent an unintended backend restart. Backend optimization rollout requires preserving the live database separately.

Production deployment completion is verified through Vercel's deployment state, commit metadata, assigned production domain and public HTTP checks. The release process restores the existing Render automatic deployment setting after the push, without requesting a backend deployment.
