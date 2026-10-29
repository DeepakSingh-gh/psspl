import { AdminRmFeedback } from "@/components/admin/admin-rm-feedback";
import "../../rm-feedback.css";

export default async function RmFeedbackPage({ searchParams }: { searchParams: Promise<{ rm?: string }> }) {
  const { rm } = await searchParams;
  return <AdminRmFeedback initialId={typeof rm === "string" ? rm : ""} />;
}
