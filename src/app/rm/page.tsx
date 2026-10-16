import { redirect } from "next/navigation";

/** RMs use the same My Day / Customer DB workspace as field sales. */
export default function RmPage() {
  redirect("/sales/my-day");
}
