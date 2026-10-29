# Phase 8 browser and mobile acceptance checklist

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](../../operations/2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Date: 18 October 2026 (Asia/Kolkata)
Execution status: **NOT VERIFIED for every case below.**

The browser-tool inventory returned `apps: []` and `browsers: []`. Selecting the in-app browser returned `Browser is not available: iab`. No browser page, screenshot, viewport emulation, real GPS permission or microphone permission was exercised. API success does not establish these results.

Use an isolated frontend pointed only to a synthetic fixture API. Keep real integrations disabled. Fix UAT-01 before testing a freshly initialized schema; a compatibility fixture must be identified explicitly. Record tester, date, browser/version, device/OS, viewport, role, steps, observed result and screenshot/download evidence. Use test accounts only. Do not use real customer audio or transmit real location without separately approved device/data testing.

| Case | Role or device | Procedure and expected evidence | Owner | Result |
| --- | --- | --- | --- | --- |
| UI01 | All roles, desktop | Enter invalid credentials, then valid synthetic credentials; correct role landing page and useful login error | QA | NOT VERIFIED |
| UI02 | All roles | Sign out and revisit protected page/back navigation; no usable protected content or API access | QA | NOT VERIFIED |
| UI03 | All roles | Expire fixture session, navigate and submit a form; return to sign-in with understandable error and no false saved state | QA | NOT VERIFIED |
| UI04 | Admin desktop | Open overview, KPIs, ranking and attention cards; match fixture periods/values, unscored RMs and provisional labels | QA and Palak Ma'am | NOT VERIFIED |
| UI05 | Admin desktop | Click RM name and attention destinations; preserve financial year and render all report tabs/dealer/product detail | QA | NOT VERIFIED |
| UI06 | Admin reports | Select explicit date/FY and every customer/product/RM/salesperson/territory/dealer filter; compare totals with fixture controls | QA and Finance | NOT VERIFIED |
| UI07 | Admin, India timezone | Verify month/last-month/FY presets after UAT-02 fix; first/last dates must retain the intended India calendar day | QA | NOT VERIFIED |
| UI08 | Admin exports | Download CSV and HTML .xls and open in intended spreadsheet app; confirm full rows, filters, units, formula-like text and exact totals | QA and Finance | NOT VERIFIED |
| UI09 | Admin PDF and RM print | Export/print multipage reports and compare all expected groups, pagination, clipping, fonts and totals; current paginated-print limitation must be fixed or accepted | QA and Palak Ma'am | NOT VERIFIED |
| UI10 | RM | Navigate team, customers, report cards, dealer intelligence, activity and follow-ups; same-team visible, other-team inaccessible | QA and RM representative | NOT VERIFIED |
| UI11 | Salesperson | Complete check-in, planned/unplanned visit, outcome/product/order/follow-up, call, daily summary and check-out; reload and verify saved state | QA and sales representative | NOT VERIFIED |
| UI12 | Salesperson | Submit missing fields, invalid dates/numbers, duplicate completion and other-owner IDs; useful errors and no unintended persistence | QA | NOT VERIFIED |
| UI13 | Salesperson/RM pipeline | Create/assign/advance a lead; inspect history, conversion and Won/Lost behavior; verify denied assignment and other-team access | QA | NOT VERIFIED |
| UI14 | Desktop plus physical Android/iOS | GPS allowed/denied/unavailable/timeout; truthful missing-location state, valid saved coordinates/accuracy and no fabricated physical-visit verification | QA and field representative | NOT VERIFIED |
| UI15 | Desktop plus physical Android/iOS | Microphone allowed/denied/unavailable; record, review, upload, replay and edit mocked transcript; useful upload/provider errors | QA and field representative | NOT VERIFIED |
| UI16 | Physical mobile browser | Check recording codec compatibility and audio retrieval after reload; denied other-owner audio remains inaccessible | QA | NOT VERIFIED |
| UI17 | Admin/RM/salesperson AI | Ask supported/unsupported and other-team questions for same period; render source/freshness/unavailable data and mocked failure safely | QA | NOT VERIFIED |
| UI18 | Admin WhatsApp configuration | Verify available configuration/history screens and disabled-send behavior; setup is API-based with no new schedule editor | QA and operator | NOT VERIFIED |
| UI19 | Desktop plus 360/390/768px viewports | Login, navigation/menu, forms, tables, charts, dialogs, report-card/PDF controls; no clipped controls or unusable horizontal layout | QA | NOT VERIFIED |
| UI20 | All roles | Simulate API offline/500/timeout; retry and error messages must be truthful, without false save success or unintended data loss | QA | NOT VERIFIED |

Passing viewport emulation does not accept physical-device permission/accuracy/recording cases. Attach actual results and client sign-off before changing requirements to COMPLETED.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](../../operations/2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
