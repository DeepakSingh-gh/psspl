# Archived employees

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

Admin page: `/admin/archived-employees`. Open **Archived employees** from the Administration sidebar or Users & access.

The page lists accounts with `users.deleted_at` set, including the salesperson accounts previously deleted from the local CRM. Names, employee codes, former RM names, region and deletion dates come from the retained user/profile identity. Removed sign-in emails, Login IDs and password hashes are not returned or displayed.

Select a person to browse:

- Visits, outcomes and notes.
- Leads and recorded follow-ups.
- Attendance and check-in/check-out details.
- Customer activities/calls and service requests.
- Customers currently assigned to the retained employee identity.
- Expected orders and saved report metadata.

Search by name, employee code, RM or region, or filter by role. Every history section uses server pagination (25 records by default, maximum 100). Pagination covers the full stored section rather than only the latest global activity entries. An empty section means no records of that type are stored for that employee.

The page and APIs are admin-only. History remains read-only. Select **Restore employee** to restore the same employee identity with a new work email, unique Login ID and password (at least 12 characters). Salespeople must be assigned to an active RM. The account becomes active immediately and moves to Users & access; CRM history and current customer ownership remain attached to the same identity. Old sessions and account tokens stay invalid. Previously removed mobile numbers and notifications are not recovered, and disabled report schedules remain disabled. No email is sent. No database migration is needed beyond the existing account-deletion schema (012).

APIs:

- `POST /api/admin/archived-users/:id/restore`: restore with `email`, `loginId`, `initialPassword` and `managerUserId` (required for salespeople). Requires admin access and records an audit entry with the password redacted.
- `GET /api/admin/archived-users`: archived identities and per-section counts.
- `GET /api/admin/archived-users/:id/history?section=visits&page=1&pageSize=25`: selected employee's history. Supported sections: `visits`, `leads`, `followUps`, `attendance`, `activities`, `requests`, `customers`, `orders`, `reports`.

The archive displays current stored records; it is not a historical snapshot taken at deletion. For example, a customer reassigned to a new owner will no longer appear in the old employee's Customers section, while the old employee's recorded visits remain attributed to them. Saved reports show stored type/date metadata; original report payloads are not rendered by this page. Records previously deleted outside the account-preservation workflow cannot be recreated by this view.

Validation uses disposable SQLite databases and mocked-provider browser fixtures. Coverage includes admin-only access, employee isolation, exact counts, paging across all records, invalid queries, read-only preservation, search, empty sections and desktop/mobile layout. No production data was changed during implementation.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
