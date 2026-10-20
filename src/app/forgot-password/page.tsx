"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const form = new FormData(event.currentTarget); const result = await authApi.requestPasswordReset(String(form.get("email"))); setMessage(result.message); }
    catch { setError("Unable to process the request. Try again later."); } finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-panel"><div className="login-panel-inner"><p className="login-eyebrow">Account recovery</p><h1>Reset your password</h1><p>Enter your work email. If the account is eligible, we will send a reset link.</p><form onSubmit={submit}><label className="login-field"><span className="login-field-label">Work email</span><input name="email" type="email" autoComplete="email" required /></label>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}<button className="login-submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form><p><Link href="/login">Back to sign in</Link></p></div></section></main>;
}
