import { AccountTokenForm } from "@/components/auth/account-token-form";
export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AccountTokenForm token={token || ""} mode="activate" />;
}
