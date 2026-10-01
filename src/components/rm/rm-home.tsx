"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, clearSession, getSessionUser } from "@/lib/api";

/** Uses the sign-in address only when it actually carries a person's name. */
function firstName(): string | null {
  const local = getSessionUser()?.email?.split("@")[0] ?? "";
  const first = local.split(/[._-]/)[0];
  if (!first || first.length < 3) return null;
  if (["admin", "administrator", "info", "sales", "office", "test"].includes(first.toLowerCase())) return null;
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}

const DESTINATIONS = [
  {
    href: "/rm/team",
    tone: "team",
    title: "My team",
    detail: "Sales, customers, outstanding and field activity for your territory.",
    icon: <><circle cx="8" cy="6" r="2.6" /><path d="M3 15c0-2.7 2.2-4.3 5-4.3s5 1.6 5 4.3" /><circle cx="15" cy="6.8" r="1.9" /><path d="M13.6 11.6c2.1 0 3.6 1.3 3.6 3.9" /></>,
  },
  {
    href: "/sales/my-day",
    tone: "day",
    title: "My day",
    detail: "Your check-in, planned visits and follow-ups for today.",
    icon: <><rect x="3" y="4.2" width="14" height="12.5" rx="2" /><path d="M3 8h14M7 2.8v2.6M13 2.8v2.6" /><path d="M7.4 12.2l1.6 1.6 3-3.2" /></>,
  },
];

export function RmHome() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    authApi.me()
      .then(({ user }) => {
        if (user.role !== "rm") { router.replace(user.role === "admin" ? "/admin" : "/sales/my-day"); return; }
        setName(firstName());
        setChecked(true);
      })
      .catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  if (!checked) {
    return <main className="rmhome"><p className="rmhome-loading">Checking your access…</p></main>;
  }

  return (
    <main className="rmhome">
      <header className="rmhome-bar">
        <span className="rmhome-brand">
          <span className="rmhome-mark" aria-hidden="true">P</span>
          <span><strong>Progressive</strong><small>Surface Systems</small></span>
        </span>
        <div className="rmhome-account">
          <span className="rmhome-role">Regional manager</span>
          <button type="button" className="rmhome-signout" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="rmhome-body">
        <h1>Welcome back{name ? `, ${name}` : ""}</h1>
        <p className="rmhome-lede">What would you like to open?</p>

        <div className="rmhome-grid">
          {DESTINATIONS.map((item) => (
            <Link className="rmhome-card" href={item.href} key={item.href}>
              <span className={`rmhome-icon is-${item.tone}`} aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
              </span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <em>Open →</em>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
