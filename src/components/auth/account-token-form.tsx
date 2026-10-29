"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";

export function AccountTokenForm({ token, mode }: { token: string; mode: "activate" | "reset" }) {
  const [resolvedToken, setResolvedToken] = useState(token);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    setResolvedToken(fragmentToken || token);
    setReady(true);
    // Keep legacy query links usable; remove either token from browser history.
    if (fragmentToken || token) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [token]);
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget); const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) { setError("Passwords do not match"); setBusy(false); return; }
    try { if (mode === "activate") await authApi.activateAccount(resolvedToken, password); else await authApi.completePasswordReset(resolvedToken, password); setDone(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This link is invalid or expired"); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-panel"><div className="login-panel-inner"><p className="login-eyebrow">{mode === "activate" ? "Account activation" : "Account recovery"}</p><h1>{mode === "activate" ? "Set your password" : "Choose a new password"}</h1>{done ? <><p role="status">{mode === "activate" ? "Your account is active." : "Your password has been reset. Other sessions were signed out."}</p><Link href="/login">Continue to sign in</Link></> : !ready ? <p>Loading secure link...</p> : resolvedToken ? <form onSubmit={submit}><label className="login-field"><span className="login-field-label">Password</span><input name="password" type="password" minLength={12} maxLength={200} autoComplete="new-password" required /></label><label className="login-field"><span className="login-field-label">Confirm password</span><input name="confirm" type="password" minLength={12} maxLength={200} autoComplete="new-password" required /></label><p>Use at least 12 characters.</p>{error && <p role="alert">{error}</p>}<button className="login-submit" disabled={busy}>{busy ? "Saving…" : mode === "activate" ? "Activate account" : "Reset password"}</button></form> : <p role="alert">The link is missing its token. Request a new one.</p>}</div></section></main>;
}
