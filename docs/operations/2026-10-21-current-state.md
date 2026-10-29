# Current local source status - 24 October 2026

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

This is the current local implementation summary. Dated reports retain the results observed when they were written; they do not establish today's production deployment or dataset state.

## Admin UI — 26 October 2026

Sales Performance Trend on `/admin/trends` matches the light Admin card theme, including the adjacent What changed card. The white tooltip, blue/green lines, signed axis and existing FY/monthly/quarterly behavior retain the same values and logic. The Admin rail omits Reporting and its two links; Field operations is followed directly by Administration. `/admin/reports` and `/admin/management-reports` remain implemented. [Current details, verification and limitations](admin-product-trends-and-sidebar.md). These are local UI changes, not a new deployment or production sign-off.

## Product Trends source recovery and MoM fallback — 26 October 2026

The existing FY sales value of ₹18.07 Cr and 552 products remain intact. The inspected FY 2025–26 invoice rows are generated `excel-import` records, not genuine dated vouchers; annual snapshot totals cannot supply partial-FY/monthly YoY. Source-backed full-FY snapshot recovery remains available for the older FYs.

With YoY unavailable, separate recorded August/July 2026 comparisons populate the existing cards and lists: +91.99% growth, +₹2.97 Cr increment, a ₹3.22 Cr July baseline, 91 gaining and 81 declining paired variants. Lifecycle reports 21 first observed selling in August, 228 without positive recorded August net sales, and 109 positive sellers in every observed April–August month. All are dated source-audit results, not current guarantees or launch/discontinuation status.

Latest authoritative invoice: 8 September 2026. Product totals reconcile to item lines; voucher headers differ by −₹1,40,246.21, with 137 invoices lacking item lines. No allocation or source-record alteration was made. Recorded checks: 19 unit/API tests, 3 browser regressions, TypeScript and production build passed. This documentation update does not rerun those checks. [Detailed findings, exact files and remaining source requirements](admin-product-trends-and-sidebar.md#product-trend-data-and-comparison-recovery).

## Claude AI

Local AI generation uses the Claude key already supplied in `.env`. Admin/RM/Salesperson Ask AI uses the shared Claude provider. The active V2 RM report uses cached Claude prioritization of verified finding IDs; AI Insights and Manager Action Plan retain vetted template wording. The legacy analysis endpoint separately generates evidence-bound recommendations. Provider failures are explicitly labeled and retain rule-based findings. One live FY prioritization request succeeded; period/scoping verification and the missing explicit RM identity payload field are documented in [finalization](rm-report-finalization.md#ai-verification-and-limits). Financial figures remain server-derived. Uploaded Whisper transcription is disabled in Claude mode; browser dictation remains available. See [Claude operations and validation](claude-ai.md).

## Supplied RM reports

The 12 supplied PDF snapshots dated 30 September 2026 feed the existing admin and RM Report Card layouts through a data adapter. Existing cards, charts, Action Plan tabs and executive download layout remain in use; the replacement PDF Feedback tab has been removed. The adapter converts lakh values to rupees, preserves blank cells, distinguishes monthly and FYTD denominators and labels the source date. Today/Week are not populated with monthly PDF aggregates. The RM print route returns the signed-in RM's matched snapshot in the original print template. No employee accounts or transactions are created by this import. See [source manifest, import and access details](rm-feedback-snapshots.md).

Achievement uses `round(actual / positive target * 100)` without a 100% cap; only progress-bar width is capped. Missing actuals/invalid targets remain unavailable, including future-month tooltips. Pradeep Mulik's supplied INR-lakh figures give August 1461% (160.72/11.00), September 1030% (124.58/12.10), FYTD 593% (397.92/67.10) and annual target achievement 301% (397.92/132.00). The denominators differ; the source PDF and compiled figures were not changed.

## Accounts and authentication

- Admin creates RM and Salesperson accounts at `/admin/users` with Login ID, work email, role and an initial password of 12 to 200 characters. Salespeople require an active RM assignment.
- New credentials work immediately. Login ID or work email uses the same password; identifiers are case-insensitive. Existing email-only accounts and pending invitations remain supported.
- **Create user** saves without sending. **Create user & Send Email** explicitly emails the entered initial password and all saved Add user fields in a professional HTML/plain-text account email. After creation and in **Manage**, the admin can also approve **Send Account Email** and re-enter a verified current password to include it. Existing password hashes cannot be decoded or retrieved.
- **My profile** opens `/profile`. Changing your own password is optional and requires current password, new password and confirmation. Admin account management remains separate from personal Security settings.
- Email provider selection supports Gmail SMTP (`smtp`), the existing Resend provider (`resend`), or `disabled`. The current interim sender is `deepaksingh873785@gmail.com`; its secret stays in local `.env`. Forgot Password uses secure single-use links expiring after 15 minutes, with generic public responses and the existing rate limits. Local links are restricted to a configured local tester; employee account-detail emails can still be sent without a usable remote link.
- Passwords use salted scrypt hashes. Password changes and resets revoke all target-account sessions, reset/activation tokens and unsent queued recovery payloads. Admin can replace a password, never retrieve it.
- Migration `011_user_login_id.sql` adds nullable Login IDs without renaming or activating existing accounts. Migration 013 pins queued email providers; migration 014 preserves queue/delivery rows while adding the token-free `account` notice purpose. Password-bearing queued templates remain encrypted, are excluded from responses/audits, and are canceled if the password changes before submission.

Details: [authentication implementation and dated test evidence](../superpowers/reports/2026-10-20-authentication-workflow.md), [Gmail SMTP and account email operations](gmail-smtp-authentication.md), [Resend setup](resend-email-authentication.md).

## Employee deletion and archive

- Delete removes sign-in access while preserving CRM history and employee attribution. It revokes sessions and tokens, cancels queued account emails and removes reusable sign-in identifiers.
- Admin cannot delete their own account or the last active administrator. Reassign an RM's nondeleted reporting employees before deleting that RM.
- Migration `012_user_account_deletion.sql` adds `users.deleted_at`. Deleted accounts are excluded from normal account management and cannot be reset or reactivated through it.
- `/admin/archived-employees` provides admin-only search, role filters, employee details and read-only paginated history. **Restore employee** restores the retained identity with new email/Login ID/password; a salesperson requires an active RM. The account returns to Users & access and can sign in immediately.
- History includes visits, leads, follow-ups, attendance, activities/calls, requests, current customer assignments, expected orders and saved report metadata.
- The archive reads current stored records, not a snapshot at deletion. Customer reassignment changes the Customers section; existing visits retain their attribution. Restoration preserves the same CRM identity and current customer ownership; removed mobile numbers/notifications are not recovered and disabled report schedules stay disabled. It sends no email automatically.

Details: [Archived Employees guide and API contracts](archived-employees.md).

## Organization and navigation

- Admin opens `/admin`; RM and Salesperson open `/sales/my-day`. The `/rm` route redirects to My Day again following the requested restoration on 22 October.
- `/admin/team-structure` shows Admin oversight, all RMs, their assigned salespeople and team counts. Expand/collapse and employee search retain parent RM context.
- Relationships use account IDs and `manager_user_id`; duplicate display names do not merge accounts. Unassigned or invalid reporting references are shown separately.
- Admin oversight is shared. The schema does not assign individual RMs to a particular administrator.

Details: [team structure guide](team-structure.md), [Admin SOP](../training/PSSPL_Admin_SOP.md).

## RM report-card update — 24 October 2026

- **V4 attendance:** the existing scoped CRM attendance source supplies a full-FY April–March
  heatmap with all seven weekday names and 365/366 dates. Chart month/week selection synchronizes the
  attendance context; local attendance arrows do not change sales selection. The detail sheet
  shows India times, valid recorded hours, worked Sundays and incomplete clock-outs. Missing
  records remain unverified; absence and attendance percentage remain N/A without verified
  employment/absence policy. [Attendance and product implementation](rm-performance-v4.md).
- **V4 thrust products:** all configured names retain their order in a 3/2/1-column grid.
  Scoped YTD product net sales use the same dates and signed invoice definitions as the
  company-wide contribution denominator. Missing thrust metrics are visually blank with accessible unavailable text. The visible verbose
  availability/scope panel is removed from the UI and active PDF; validation/provenance remain.
- **Rais Khan only, code 033705:** a separate frontend client-snapshot file fills missing
  territory expansion, the August Week 2 actual of 3.11 lakh, and two missing product names.
  Every fallback has a compact **Demo Preview** badge. New product amounts
  remain unavailable/visually blank in live mode; original populated values and valid zeros have priority. Annual unit handling
  uses lakhs per the delegated business decision, and source discrepancies remain flagged.
  [Filled/preserved fields and discrepancy audit](rais-khan-client-snapshot.md).
- The current yearly values remain annual target **123.03 L**, target through cutoff **62.54 L**,
  actual **53.15 L** and achievement **84.99%**. The frontend fallback changes no backend
  calculations, AI evidence, attendance, account relationships or database records. Other RMs,
  salesperson selections and unrelated financial years receive no Rais Khan fallback.
- Recorded implementation verification: 6 snapshot checks and 5 V4 regressions passed,
  TypeScript/production build passed, and a read-only audit verified preservation across
  31 financial contexts. Desktop/mobile UI and downloaded PDFs were inspected. These are
  implementation results, not tests rerun by this Markdown update. No commit/push/deploy occurred.

## RM report-card update — 23 October 2026

- **RM Save Entries** shows one row per completed visit, merging its
  linked expected order, follow-up and generated lead stage. Planned/in-progress
  visits remain visible on My Day, while independent saved CRM records retain
  separate rows. The local Rais Khan projection returned one row after this fix;
  no business records were deleted. See [V3 report behavior](rm-performance-v3.md#current-compact-saved-entry-table).
- **Customer & business performance → Thrust Products** is rendered in
  `src/components/reports/rm-performance-view.tsx`; the report builder uses
  `calculateThrustProductsForNames` in `server/admin.mjs` and the configured
  `thrust_products` table. Missing product sales remain unavailable.
- Admin and RM report-card identity headers no longer show the supplied-snapshot date, Tally sync availability, or financial-year status strip. Source and period details remain in the report context where relevant.
- The RM report-card selector lists active salespeople assigned to the selected RM. Choosing a salesperson scopes the financial and CRM projections, saved My Day entries, insights and PDF to that account; **RM & full team** retains the aggregate view. Unassigned salespeople are not inferred from PDF coverage names.
- Rais Khan's RM identity displays code **033705** in his RM dashboard and report card. The code is shown only for Rais Khan; other RM and salesperson identity codes remain profile-backed.
- TypeScript and server syntax checks passed for these presentation/identity changes. The update changes no account assignments or business records and is local validation, not deployment approval.

## Performance and refresh behavior

### RM report-card update — 22 October 2026

- Team performance no longer displays the CRM Account column. RM detail loading uses indexed/consolidated queries and client prefetch/caching; the RM page also has a loading state.
- RM detail headers omit the repeated region/source/section subtitle. Report Card omits the repeated Achievement card and Field Activity panel.
- The Report Card retains real RM identity, dated PDF sales/target figures and live CRM KPIs. If pipeline, dealer or product rows are empty, those three sections alone display presentation examples marked **Demo**. Demo values are generated separately for Today, This Week, This Month and FYTD; they are not written to CRM, counted in actual sales/targets or linked to customer records. Existing real rows take precedence. The two-page download preview marks example customer/product tables **Demo** as well.
- Rais Khan's empty **Today** and **This Week** Report Card views additionally show a display-only live-data preview: period-specific sales/target pace, visits, calls and follow-ups. The report and PDF label it **Demo preview**. The chart follows the selection: Today shows today's bar; This Week shows Mon–Sat day-by-day, including Saturday. Saturday's target is included in the weekly target, while actual sales remain unavailable until recorded. Real activity/sales replace this preview when present; other RMs, other tabs and AI analysis are unchanged.
- Hovering or focusing a chart bar opens its details beside the graph and leaving the graph hides them. The admin Report Card UI puts period KPIs ahead of the chart, hides empty milestones, presents PDF product names compactly when no individual sales are supplied, and uses neutral compact states for unavailable dealer metrics. Empty dealer comparison headings and internal threshold configuration text are removed. Narrow screens can reach all period controls and download; tabs and chart scroll within their own sections rather than clipping the report.
- Today/This Week use CRM activity and available operational figures; This Month/FYTD retain the appropriate dated PDF snapshot and source label. The selected period is reflected in the report and PDF filename. Missing targets/actuals stay unavailable rather than becoming fabricated performance.
- Month and FYTD retain the dated monthly snapshot chart; Today and This Week show the selected operational period in both the report and PDF. Month/FYTD are unaffected by Rais Khan's Today/Week preview. Missing targets/actuals stay unavailable rather than becoming fabricated performance.
- Local verification: TypeScript and the four-period browser/PDF test passed after the period chart and Saturday updates. This is local validation, not a new production acceptance.

- Poor-to-good sorts ascending and good-to-poor descending. Known achievement percentages determine the order when any member has a finite achievement; missing/nonfinite achievements stay last in both directions. Sales value is used only when no member has achievement data.
- Missing numeric sales values sort last; stable name/ID comparisons resolve ties. Missing targets are not invented.
- **Refresh Data** requests registered client loaders and a Next.js route refresh. It preserves local tab/filter state instead of reloading the document.
- Admin content reserves bottom space for the floating refresh control so pagination remains accessible, including mobile safe areas. The control is hidden in print.

### Admin navigation and Product Trends — 22 October 2026

- Sidebar hover/focus prefetches routes and selected initial page data; opening a tab shares any in-flight request. Existing short-lived caching and Refresh Data remain active.
- Product Trends combines repeated aggregates and reuses financial-year lookups, reducing SQL queries from 17 to 11. Migration `015_report_query_indexes.sql` adds covering indexes without changing business records.
- Local response comparisons matched both financial-year baselines exactly. Browser checks measured about 509 ms for navigation and 306 ms for a cached revisit; initial development compilation can take longer.
- TypeScript, navigation/cache/refresh checks and 20 financial/report regression tests passed. These measurements describe local verification, not a production rollout.

## Field location and check-in

- Browser location failure does not block attendance: check-in can be saved without coordinates. The current check-in request uses `enableHighAccuracy: false` with a six-second timeout. The generic GPS warning does not identify whether permission, availability or timeout caused the failure.
- Admin opens **Field activity → Attendance**. **View check-in on map** opens the saved starting coordinates as a map pin. Missing coordinates remain **Not captured**; later permission does not recover the original check-in location.
- **View route** shows stored route points/times and an **Open latest location on map** link. Browser location evidence has device-reported accuracy and is not a guaranteed exact-building fix. This work did not add a high-accuracy retry/check-in recovery flow.

## Employee emails and local/remote access

- Professional account emails contain Login ID, registered email, supplied/verified password, full name, mobile, role, reporting RM, region, territory, employee code and monthly target. Confirm-password is not duplicated.
- A usable CRM URL enables the access URL and optional 15-minute setup link. Without one, account details can still be sent, but no broken localhost link is sent to an employee on another device. Remote sign-in still requires a reachable CRM using the matching account database.
- SMTP acceptance is separate from inbox delivery. Duplicate requests show the previous status and retain the 60-second cooldown. Ambiguous SMTP submissions are not automatically replayed; Resend retains its idempotent retry and signed-webhook behavior.
- Gmail authentication was verified locally. Separately authorized earlier notices to the user's test recipient were accepted; the user provided an inbox screenshot. Those notices did not contain passwords, and no real password-bearing message was sent while implementing the new professional template.

## Recorded validation

These are earlier implementation runs, not a new complete suite run for this documentation update. Counts belong to their individual scopes and must not be added together as unique coverage.

| Scope | Recorded result |
| --- | --- |
| Initial authentication implementation | 103 non-browser tests and 4 browser tests passed; TypeScript and isolated production build passed |
| Subsequent authentication workflow suite | 8 tests passed; separate email-login browser check passed |
| Team performance sorting | 10 management tests and targeted browser check passed |
| Account deletion | 4 deletion tests and targeted browser check passed |
| Team structure | 4 grouping tests, 11 security tests and targeted browser check passed |
| Archived Employees and restoration | 8 archive/restore tests plus 4 deletion tests passed in the later restore run; TypeScript and mocked browser flow passed |
| Refresh/pagination clearance | Targeted desktop/mobile browser check passed |
| Account email with password and complete profile | 12 authentication tests passed per mocked provider (Resend and SMTP); template tests (2), SMTP queue checks (1), provider/restart checks and browser/mobile checks passed in their respective runs |
| Email schema upgrade | Populated queue/delivery preservation and indexes passed for migration 014 |
| Latest credential-email build | TypeScript and production build passed; no deployment performed |
| Claude integration | 73 tests and 2 mocked browser flows passed; build/type checks passed; live local provider and structured-analysis checks succeeded |
| RM percentage review | 41 adapter/API/management/security tests passed; dedicated admin/RM percentage browser flow, production build and TypeScript passed |
| Requested Vijay archive | 42 scoped deletion/security/RM tests passed; isolated current-database copy verified 12 supplied reporting entries and retained workbook history |

## Local data operation and outstanding risks

- A separately authorized local operation on 21 October removed 11 Salesperson sign-in accounts, retaining CRM history. Its post-operation snapshot had 1 Admin, 13 RMs and 0 nondeleted Salespeople; these are dated local counts, not fixed product totals.
- Later on 21 October, authorized duplicate cleanup retained Anil Jena's `rm-anil-jena` account and archived `rm-anil-alias`; the retained RM's 10 reporting profiles and 62 customers were unchanged. The separately requested Vijay Nair account removal archived `rm-vijay-nair`, retaining historical workbook sales. Both operations took consistent backups first under ignored `scratch/rm-feedback/`. Active reporting excludes archived identities; the 12 supplied PDF RMs remain available without manufacturing CRM logins.
- A backup and operation report were retained under ignored `scratch/account-backups/`. Do not publish database backups or environment credentials.
- That operation detected 5,834 pre-existing Tally foreign-key inconsistencies and added none. Data-quality remediation remains separate work.
- Historical audit rows may contain initial passwords from the earlier logger. Future logging is redacted; historical logs and backups have not been scrubbed by this implementation.
- Already submitted email cannot be recalled. A password emailed earlier remains usable until it is changed; revoking a setup link alone does not invalidate an unchanged password. Resend delivery reporting needs its approved sender and signed webhook; Gmail acceptance alone is not confirmed delivery. SMTP App Passwords and queue encryption keys must remain in backend secrets.
- A reachable HTTPS CRM URL and matching remote account database are still required for employee sign-in from other devices. Deploy the API, client and migrations together after backup/review. SQLite session storage and in-process rate limits remain deployment constraints for independent API instances.
- This documentation update does not migrate data, send email, commit, push or deploy. No new production rollout was verified. See the [dated readiness report](../../PSSPL_FINAL_PRODUCTION_READINESS_REPORT.md) for outstanding acceptance and release gates.

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
