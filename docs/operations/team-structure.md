# Admin team structure

<!-- current-admin-ui:start -->
> Latest local UI notes (27-10-2026): explicit Rais Khan top-five sample previews and the RM-only Monthly target card removal are documented in [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-admin-ui:end -->

<!-- current-source-status:start -->
> Current source status (27-10-2026): backend RM rankings remain source-backed. Local Admin preview can fill empty products or append clearly marked sample customers without changing real rows, totals or database records. See [the latest preview and dashboard notes](2026-10-27-ui-adjustments.md#local-top-five-samples-and-rm-dashboard-cleanup). Overview cleanup, period filters and shared PDF rendering remain. Earlier dated verification retains its scope; this Markdown update does not rerun tests or establish deployment/client acceptance.
<!-- current-source-status:end -->

The admin **Team structure** page is available at `/admin/team-structure`, from the Administration sidebar or **View team structure** on Users & access.

The view includes:

- Administrator accounts and CRM-wide oversight totals.
- Total RMs, active/inactive RM counts, total salespeople and the number requiring an RM assignment.
- One expandable card for every RM, showing their account email, employee code, region, team count and assigned salespeople.
- Names, employee codes, work emails and active/inactive/invitation-pending status for salespeople.
- Search by RM or salesperson name, email, Login ID, employee code, region or territory. Salesperson results retain their parent RM and full team counts.
- Expand all/collapse all controls and a separate section for missing or invalid RM assignments.

Reporting uses `salesperson_profiles.manager_user_id` and account IDs. Similar names, spelling aliases and regions never create a reporting relationship. Multiple RM accounts with the same name remain separate. Inactive and pending accounts remain visible with explicit statuses; accounts deleted from Users & access remain excluded by the existing API.

The CRM has shared administrator oversight. This view does not invent an individual admin-to-RM ownership mapping. Use **Manage accounts** to change assignments through the existing admin workflow, then refresh the structure view to see the latest relationships.

The page reuses the admin-only Users API and the existing Admin layout/access checks. It adds no database migration and does not change assignments, permissions or account data.

<!-- current-rm-report-card-2026-10-24 -->
> **24 October 2026 RM report-card update:** [Current implementation and recorded validation](2026-10-21-current-state.md#rm-report-card-update--24-october-2026). Earlier dated findings in this file retain their original scope.
