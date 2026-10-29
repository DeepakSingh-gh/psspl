import { redirect } from "next/navigation";

/** Preserve the RM field workspace and support existing dashboard bookmarks. */
export default function RmPage() {
  redirect("/sales/my-day");
}
