import { AdminActivity } from "@/components/admin/admin-activity";

/** Kept so existing links to /admin/alerts still work; opens the merged page on Alerts. */
export default function AdminAlertsPage() {
  return <AdminActivity initialSection="alerts" />;
}
