"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, clearSession, homePathFor } from "@/lib/api";
import type { SessionUser } from "@/types/admin";
import "./profile.css";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    authApi.me().then(({ user }) => setUser(user)).catch(() => router.replace("/login"));
  }, [router]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    setError("");
    if (newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    setBusy(true);
    try {
      await authApi.changePassword(currentPassword, newPassword, confirmPassword);
      form.reset();
      clearSession();
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to change your password"); }
    finally { setBusy(false); }
  }

  return <main className="account-profile-page">
    <h1>Profile</h1>
    {!user ? <p role="status">Loading profile…</p> : <>
      <p>{user.email} · {user.role === "rm" ? "Regional manager" : user.role === "admin" ? "Administrator" : "Salesperson"}</p>
      {!done && <>
        <nav className="account-profile-actions" aria-label="Account navigation">
          {user.role === "admin" && <Link className="account-profile-primary" href="/admin/users">Manage employee accounts</Link>}
          <Link className="account-profile-secondary" href={homePathFor(user.role)}>{user.role === "admin" ? "Back to admin dashboard" : "Back to workspace"}</Link>
        </nav>
        {user.role === "admin" && <p>Create RM and Salesperson Login IDs and initial passwords in <Link href="/admin/users">Users &amp; access</Link>.</p>}
      </>}
      <h2 id="security">Security</h2>
      {done ? <div role="status"><p>Your password has changed. All sessions have been signed out.</p><Link href="/login">Sign in with your new password</Link></div> : <>
        <p>Changing your own password is optional. You can continue using the CRM without changing it.</p>
        <details className="account-profile-security">
        <summary>Change my password</summary>
        <p>This changes only your own password, signs you out on all devices and cancels existing password reset links.</p>
        <form onSubmit={changePassword}>
          <label className="account-profile-field"><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={200} /></label>
          <label className="account-profile-field"><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></label>
          <label className="account-profile-field"><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></label>
          <p>Use 12 to 200 characters.</p>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="account-profile-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </form>
        </details>
      </>}
    </>}
  </main>;
}
