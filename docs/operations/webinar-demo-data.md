# Webinar demo data

Set `CRM_ENABLE_WEBINAR_DEMO_DATA=true` on the API service and redeploy it to add a small, repeat-safe sample dataset. The seed adds two `[Demo]` customers and two labelled sample invoices for each active RM and salesperson, plus linked visits, follow-ups, a lead, a service request, an activity, and an expected order. It also adds two `[Demo]` products. Existing rows are left intact.

The sample invoices are included in sales and performance totals while the demo dataset is present. Use this setting only for a showcase environment. To return to the original baseline on the current ephemeral Render service, remove the setting and redeploy the backend. For a persistent database, remove the rows with IDs beginning `webinar-demo-` in foreign-key order after taking a backup.
