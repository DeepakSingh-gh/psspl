# Claude AI operations

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Local implementation updated on 21 October 2026. The existing CRM UI is retained.

## Backend configuration

```dotenv
CRM_AI_PROVIDER=claude
ANTHROPIC_API_KEY=enter-your-key-locally
ANTHROPIC_MODEL=claude-sonnet-4-6
```

The existing local `Claude api key` variable and `CLAUDE_API_KEY` are also accepted. No secret was copied into source code, examples, logs, browser bundles or API responses. The current local `.env` selects Claude and its model; the existing secret is retained. Hosting should use the conventional `ANTHROPIC_API_KEY` name. Restart the API after changing environment values.

`server/ai-provider.mjs` calls the [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create) with server-only authentication. When Claude is selected, failures do not fall back to OpenAI or Gemini. Legacy provider implementations remain available for existing installations configured without Claude. Errors expose a safe unavailable message, never the provider body or credential.

## Active V2 RM report flow — verified 24 October 2026

`enrichPerformanceReview` prioritizes verified finding IDs for the current RM report. The model does not write unrestricted insight/action prose; both sections render the existing vetted templates and label deterministic fallback correctly. One live Claude request verified Rais Khan FY 2026–27 with four supported findings and unchanged metrics. Isolated stubs verify FY/month/week payloads, RM cache isolation and provider/validation failure. The payload has RM-scoped facts and period dates, but no explicit RM name/ID. Five UI categories remain, with unavailable categories left unavailable. PDF uses the same findings/actions. Prompts, model settings and credentials were not changed. See [verification evidence and limits](rm-report-finalization.md#ai-verification-and-limits).

## Existing shared and legacy analysis features

- Admin, RM and Salesperson **Ask AI** use Claude through the shared provider. Existing role-scoped context, rate limits, authorized evidence selection and server-rendered facts remain enforced.
- The legacy admin RM **Manager Action Plan** and **AI Insights** call the admin-only `POST /api/admin/team/:id/ai-analysis`. One generated analysis supplies both views and their existing executive PDF download. The API accepts dates and a period preset, not client financial figures.
- The server resolves an active RM, uses the supplied dated PDF financial evidence for supported month/FYTD views, or authorized live RM context for other periods. PDF figures are not labeled as today's activity.
- Claude returns recommendations tied to server-issued evidence IDs. The server validates structure, rejects duplicate/unknown references and numeric claims in generated prose, and supplies the exact metric, date range and severity itself. One corrective generation is allowed for unsupported output; invalid final output is an error.
- Validated results are cached for five minutes by actor, report evidence and model, with in-flight request coalescing and bounded cache size. Financial charts and tables never depend on generation.
- During generation the existing view shows a status line. Provider failure shows an unavailable message and explicitly labeled rule-based findings. Such fallback findings are not presented as Claude output.

The shared Ask AI endpoint retains its deliberate evidence-only answer contract; it does not grant arbitrary database access or allow a model to execute actions.

## Voice limitation

The existing uploaded-audio transcription endpoint uses Whisper, which cannot be authenticated with a Claude key. It is disabled in Claude mode so audio is not silently sent to OpenAI. Browser voice dictation and typing remain available. Anthropic's [audio-input feature discussion](https://github.com/anthropics/anthropic-sdk-python/issues/1198) documents the distinction between Messages input and audio transcription; a Claude key is not an OpenAI speech credential.

## Validation and deployment

Live local checks confirmed a Claude API response and a successful structured RM analysis using the supplied PDF evidence in an isolated database. No email was sent and no deployment performed.

Tests include `scripts/claude-provider.test.mjs`, existing AI-provider and phase 7 grounding/authorization suites, RM analysis evidence/cache/authorization tests in `scripts/rm-feedback.test.mjs`, and mocked browser verification of Claude content in the existing Action Plan and AI Insights tabs. Fixture launchers scrub Claude/Anthropic credentials to prevent unintended external calls. Temporary build caches under `scratch` are excluded from TypeScript source checking.

Final local results: 73 provider, grounding, authentication, security, RM and workflow tests passed; both browser regression flows passed; production build and type checking passed. Live structured Claude generation returned two validated recommendations against the supplied snapshot. Existing CSS compatibility warnings are unrelated to this AI integration.

For deployment, configure the provider, model and secret on the backend host, ensure outbound HTTPS to `api.anthropic.com`, and verify account credits/model access. Local validation does not establish production rollout.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.

<!-- rm-report-current:start -->
## Historical RM report card - 22-10-2026

- Select an RM (Admin only), Weekly / Monthly / Yearly, financial year, month and week as applicable. Press **View Report** to apply and open the Report Card tab. RM accounts remain restricted to their authorized data.
- Desktop filters are compact; KPIs and chart come first, with insights/actions side by side and stacked mobile sections. PDF retains two A4 pages.
- **Download PDF** also applies pending filters, opens the matching preview and saves from its download button. Export errors provide a retry message; filenames use selected-period dates.
- Executive Territory Coverage groups each executive with their cities beneath the profile and on PDF page 2. The supplied-report date is visible; dealer locations are not substituted as executive assignments.
- Rais Khan reuses existing supplied monthly/weekly/yearly financial data when live invoices are absent; separately labeled sample details remain a documented presentation exception. Missing source achievements stay unavailable. Other RMs receive no sample fallback.
- Latest local checks: all 5 dynamic-period tests, TypeScript and changed-file whitespace checks passed, including dashboard/PDF mapping parity and PDF footer fit.

See [period rules, source limitations and verification](rm-period-reports.md) and [other UI/loading changes](2026-10-22-ui-and-performance.md). The proposed Claude Call Sheet image is a preview, not an implemented feature set. No production deployment or production-data modification was performed for these updates.
<!-- rm-report-current:end -->
