"use client";
import { FormEvent, useState } from "react";
import { AdminPage, AdminState } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminUser, UserRole } from "@/types/admin";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  rm: "Regional manager",
  salesperson: "Salesperson",
};

export function AdminUsers() {
  const { data, loading, error, reload } = useAdminData(() => adminApi.users(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState("");
  const accounts = usePagination(data?.items, 25);

  function afterChange(message: string) {
    setNotice(message);
    setCreating(false);
    setEditing(null);
    reload();
  }

  return (
    <AdminPage
      eyebrow="Access control"
      title="Users and roles"
      description="CRM sign-in accounts. Roles decide what each person can open: salespeople get My Day, administrators get this console."
      actions={<button type="button" className="admin-button" onClick={() => { setNotice(""); setCreating(true); }}>Add user</button>}
    >
      {notice && <p className="admin-note success" role="status">{notice}</p>}

      <AdminState loading={loading} error={error} onRetry={reload} empty={!data?.items.length}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Person</th><th>Role</th><th>Region / territory</th>
                <th className="numeric">Monthly target</th><th className="numeric">Visits</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {accounts.rows.map((user) => (
                <tr key={user.id} className={user.active ? undefined : "is-inactive"}>
                  <td>
                    <strong className="admin-cell-title">{user.fullName ?? user.email}</strong>
                    <small>{user.email}{user.employeeCode ? ` · ${user.employeeCode}` : ""}</small>
                  </td>
                  <td><span className="admin-tag">{ROLE_LABEL[user.role]}</span></td>
                  <td>{user.region || "—"}<small>{user.territory || ""}</small></td>
                  <td className="numeric">{user.monthlyTarget ? `₹${user.monthlyTarget} Cr` : "—"}</td>
                  <td className="numeric">{formatNumber(user.visitCount)}</td>
                  <td>
                    <span className={`admin-pill ${user.active ? "positive" : "negative"}`}>{user.active ? "Active" : "Deactivated"}</span>
                    <small>{user.activeSessions > 0 ? `${user.activeSessions} active session${user.activeSessions > 1 ? "s" : ""}` : `Added ${formatDate(user.createdAt)}`}</small>
                  </td>
                  <td className="numeric">
                    <button type="button" className="admin-button ghost small" onClick={() => { setNotice(""); setEditing(user); }}>Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pagination={accounts} label="accounts" />
      </AdminState>

      {creating && <CreateUserDialog onClose={() => setCreating(false)} onCreated={(email) => afterChange(`${email} can now sign in.`)} />}
      {editing && <ManageUserDialog user={editing} onClose={() => setEditing(null)} onSaved={afterChange} />}
    </AdminPage>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      {children}
      {hint && <small className="admin-field-hint">{hint}</small>}
    </label>
  );
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    try {
      await adminApi.createUser({
        email,
        password: String(form.get("password")),
        role: String(form.get("role")) as UserRole,
        fullName: String(form.get("fullName")),
        employeeCode: String(form.get("employeeCode") || "") || undefined,
        region: String(form.get("region") || "") || undefined,
        territory: String(form.get("territory") || "") || undefined,
        monthlyTarget: Number(form.get("monthlyTarget") || 0),
      });
      onCreated(email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Add a user" onClose={onClose}>
      <form onSubmit={submit} className="admin-form">
        <Field label="Full name"><input name="fullName" required minLength={2} placeholder="Ketan Bhatt" /></Field>
        <Field label="Work email"><input name="email" type="email" required placeholder="name@psspl.com" /></Field>
        <Field label="Temporary password" hint="At least 8 characters. Share it with the person and ask them to change it."><input name="password" type="text" required minLength={8} /></Field>
        <Field label="Role">
          <select name="role" defaultValue="salesperson">
            <option value="salesperson">Salesperson</option>
            <option value="rm">Regional manager</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
        <div className="admin-form-row">
          <Field label="Region"><input name="region" placeholder="West Region" /></Field>
          <Field label="Territory"><input name="territory" placeholder="Mumbai / Pune" /></Field>
        </div>
        <div className="admin-form-row">
          <Field label="Employee code" hint="Generated if left blank."><input name="employeeCode" placeholder="PSSPL-S-014" /></Field>
          <Field label="Monthly target (₹ Cr)"><input name="monthlyTarget" type="number" step="0.1" min="0" defaultValue="0" /></Field>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-dialog-actions">
          <button type="button" className="admin-button ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="admin-button" disabled={saving}>{saving ? "Creating…" : "Create user"}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ManageUserDialog({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (message: string) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await adminApi.updateUser(user.id, {
        fullName: String(form.get("fullName")),
        role: String(form.get("role")) as UserRole,
        region: String(form.get("region") || ""),
        territory: String(form.get("territory") || ""),
        monthlyTarget: Number(form.get("monthlyTarget") || 0),
      });
      onSaved(`Saved changes for ${user.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save these changes");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setError("");
    setSaving(true);
    try {
      await adminApi.updateUser(user.id, { active: !user.active });
      onSaved(user.active ? `${user.email} has been deactivated and signed out.` : `${user.email} can sign in again.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change this account");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await adminApi.resetPassword(user.id, password);
      onSaved(`Password reset for ${user.email}. Other devices were signed out.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset the password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={user.fullName ?? user.email} onClose={onClose}>
      <form onSubmit={saveProfile} className="admin-form">
        <Field label="Full name"><input name="fullName" defaultValue={user.fullName ?? ""} required minLength={2} /></Field>
        <Field label="Role">
          <select name="role" defaultValue={user.role}>
            <option value="salesperson">Salesperson</option>
            <option value="rm">Regional manager</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
        <div className="admin-form-row">
          <Field label="Region"><input name="region" defaultValue={user.region ?? ""} /></Field>
          <Field label="Territory"><input name="territory" defaultValue={user.territory ?? ""} /></Field>
        </div>
        <Field label="Monthly target (₹ Cr)"><input name="monthlyTarget" type="number" step="0.1" min="0" defaultValue={user.monthlyTarget ?? 0} /></Field>
        <div className="admin-dialog-actions">
          <button type="button" className="admin-button ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="admin-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>

      <hr className="admin-divider" />

      <section className="admin-form">
        <h3>Password</h3>
        <Field label="Set a new password" hint="At least 8 characters. Signs the person out of other devices.">
          <input type="text" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" />
        </Field>
        <div className="admin-dialog-actions left">
          <button type="button" className="admin-button ghost" onClick={resetPassword} disabled={saving || password.length < 8}>Reset password</button>
        </div>
      </section>

      <hr className="admin-divider" />

      <section className="admin-form">
        <h3>{user.active ? "Deactivate account" : "Reactivate account"}</h3>
        <p className="admin-note subtle">
          {user.active
            ? "The person is signed out immediately and cannot sign in again until reactivated. Their recorded visits and follow-ups are kept."
            : "The person will be able to sign in again with their existing password."}
        </p>
        <div className="admin-dialog-actions left">
          <button type="button" className={`admin-button ${user.active ? "danger" : "ghost"}`} onClick={toggleActive} disabled={saving}>
            {user.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </section>

      {error && <p className="admin-error" role="alert">{error}</p>}
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="admin-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="admin-drawer-scrim" onClick={onClose} aria-label="Close" />
      <div className="admin-drawer-panel">
        <header>
          <div>
            <p className="admin-eyebrow">User</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="admin-button ghost small" onClick={onClose}>Close</button>
        </header>
        {children}
      </div>
    </div>
  );
}
