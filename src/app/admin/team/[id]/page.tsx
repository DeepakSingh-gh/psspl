import { AdminRmDetail } from "@/components/admin/admin-rm-detail";

export default async function AdminRmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminRmDetail rmId={id} />;
}
