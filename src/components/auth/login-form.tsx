"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, getSessionUser, hasSession, homePathFor, saveSession, saveSessionUser } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (hasSession()) router.replace(homePathFor(getSessionUser()?.role)); }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    try { const result = await authApi.login(String(form.get("email")), String(form.get("password"))); saveSession(result.token); saveSessionUser(result.user); router.replace(homePathFor(result.user.role)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); }
    finally { setLoading(false); }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">P</span>
            <span className="login-brand-name">
              <strong>Progressive</strong>
              <small>Surface Systems</small>
            </span>
          </div>

          <div className="login-copy">
            <p className="login-eyebrow">CRM Access</p>
            <h1>Welcome back</h1>
            <span>Sign in to plan visits, record customer discussions and track your performance.</span>
          </div>

          <form onSubmit={submit}>
            <label className="login-field">
              <span className="login-field-label">Work email</span>
              <input name="email" type="email" autoComplete="email" placeholder="name@psspl.com" required />
            </label>

            <label className="login-field">
              <span className="login-field-label">Password</span>
              <span className="login-input-wrap">
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required />
                <button
                  type="button"
                  className="login-reveal"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {error && (
              <div className="form-error" role="alert">
                <span className="form-error-mark" aria-hidden="true">!</span>
                <span>{error}</span>
              </div>
            )}

            <button className="login-submit" disabled={loading} aria-busy={loading}>
              <span>Sign in to CRM</span>
              {loading && <span className="login-spinner" aria-hidden="true" />}
              {loading && <span className="login-sr-only">Signing in</span>}
            </button>
          </form>

        </div>
      </section>

      <section className="login-visual">
        {/* Decorative field-activity atmosphere: route lines, customer nodes and a performance trend. */}
        <svg className="login-visual-lines" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="routeFade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#73C8F2" stopOpacity="0" />
              <stop offset="45%" stopColor="#73C8F2" stopOpacity=".5" />
              <stop offset="100%" stopColor="#73C8F2" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trendFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#16A5E0" stopOpacity=".08" />
              <stop offset="100%" stopColor="#73C8F2" stopOpacity=".65" />
            </linearGradient>
            <pattern id="fieldGrid" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M56 0H0V56" fill="none" stroke="#9BD4F5" strokeOpacity=".07" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="800" height="900" fill="url(#fieldGrid)" />
          <path d="M-40 250 C 160 180, 240 380, 430 330 S 700 190, 880 280" fill="none" stroke="url(#routeFade)" strokeWidth="1.4" />
          <path d="M-40 640 C 180 700, 280 520, 470 560 S 720 700, 880 610" fill="none" stroke="url(#routeFade)" strokeWidth="1.4" />
          <path d="M120 900 C 200 700, 140 520, 300 400 S 520 220, 560 -20" fill="none" stroke="#73C8F2" strokeOpacity=".12" strokeWidth="1" strokeDasharray="5 9" />
          <path d="M60 760 L 200 690 L 330 715 L 470 600 L 610 630 L 760 520" fill="none" stroke="url(#trendFade)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <g fill="#73C8F2">
            <circle cx="200" cy="690" r="3.5" fillOpacity=".55" />
            <circle cx="470" cy="600" r="3.5" fillOpacity=".55" />
            <circle cx="760" cy="520" r="4.5" fillOpacity=".85" />
            <circle cx="430" cy="330" r="4" fillOpacity=".6" />
            <circle cx="140" cy="212" r="3" fillOpacity=".35" />
            <circle cx="676" cy="243" r="3" fillOpacity=".35" />
          </g>
          <g stroke="#73C8F2" strokeOpacity=".16" fill="none">
            <circle cx="430" cy="330" r="26" />
            <circle cx="430" cy="330" r="52" />
          </g>
        </svg>

        <div className="login-visual-inner">
          <div className="login-visual-copy">
            <p className="login-eyebrow">One connected view</p>
            <h2>Field activity<br />meets trusted Tally<br />data.</h2>
            <ul>
              <li><span className="login-check" aria-hidden="true">✓</span>Customers and products from Tally</li>
              <li><span className="login-check" aria-hidden="true">✓</span>Visits and follow-ups entered by salespeople</li>
              <li><span className="login-check" aria-hidden="true">✓</span>Sales performance calculated from synced invoices</li>
            </ul>
          </div>

          {/* Illustrative product preview only - not live data, so it is hidden from assistive tech. */}
          <div className="login-preview" aria-hidden="true">
            <article className="login-preview-card">
              <header>
                <span className="login-preview-eyebrow">Field activity</span>
                <span className="login-preview-tag">Today</span>
              </header>
              <dl>
                <div><dt>Today&apos;s visits</dt><dd>12</dd></div>
                <div><dt>Follow-ups due</dt><dd>8</dd></div>
                <div><dt>Sales performance</dt><dd>87%</dd></div>
              </dl>
              <div className="login-preview-bar"><span style={{ width: "87%" }} /></div>
            </article>

            <article className="login-preview-feed">
              <span className="login-preview-eyebrow">Customer activity</span>
              <ul>
                <li><i className="login-preview-dot is-done" />Visit completed</li>
                <li><i className="login-preview-dot is-next" />Follow-up scheduled</li>
                <li><i className="login-preview-dot is-sync" />Invoice synced from Tally</li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
