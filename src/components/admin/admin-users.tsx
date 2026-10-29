"use client";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { adminApi, ApiError } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminUser, UserRole } from "@/types/admin";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  rm: "Regional manager",
  salesperson: "Salesperson",
};

const INVITATION_STATUS: Record<NonNullable<AdminUser["invitationEmailStatus"]>, string> = {
  not_configured: "Email not configured",
  queued: "Queued for delivery",
  processing: "Submitting to email provider",
  canceled: "Invitation replaced or canceled",
  expired: "Invitation expired before sending",
  accepted: "Accepted by email provider; delivery not confirmed",
  sent: "Sent by email provider; awaiting delivery confirmation",
  delivered: "Delivered (confirmed by provider)",
  delivery_delayed: "Delivery delayed",
  bounced: "Bounced",
  complained: "Marked as spam",
  failed: "Email failed",
  unknown: "Delivery status unknown",
  suppressed: "Suppressed by provider",
};

export function AdminUsers() {
  const { data, loading, error, reload } = useAdminData(() => adminApi.users(), [], "admin-users");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "rm" | "salesperson">("all");
  const [sortOrder, setSortOrder] = useState<"name-asc" | "name-desc" | "rm-first" | "salesperson-first">("name-asc");
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const matches = (data?.items ?? []).filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!term) return true;
      return [user.fullName, user.loginId, user.email, user.employeeCode, user.mobileNumber].some((value) => value?.toLocaleLowerCase().includes(term));
    });
    const roleOrder = (role: UserRole) => sortOrder === "rm-first"
      ? role === "rm" ? 0 : role === "salesperson" ? 1 : 2
      : role === "salesperson" ? 0 : role === "rm" ? 1 : 2;
    return [...matches].sort((a, b) => {
      if (sortOrder === "rm-first" || sortOrder === "salesperson-first") {
        const byRole = roleOrder(a.role) - roleOrder(b.role);
        if (byRole) return byRole;
      }
      const byName = (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email, "en", { sensitivity: "base" });
      return sortOrder === "name-desc" ? -byName : byName;
    });
  }, [data?.items, roleFilter, search, sortOrder]);
  const accounts = usePagination(filteredUsers, 25, `${search}|${roleFilter}|${sortOrder}`);

  function afterChange(message: string) {
    setNotice(message);
    setCreating(false);
    setEditing(null);
    setDeleting(null);
    reload();
  }

  return (
    <AdminPage
      eyebrow="Access control"
      title="Users and roles"
      description="Manage CRM sign-in accounts and reporting lines. RMs see their assigned team, salespeople see their workspace, and administrators manage the CRM."
      actions={<><Link className="admin-button ghost" href="/admin/archived-employees">Archived employees</Link><Link className="admin-button ghost" href="/admin/team-structure">View team structure</Link><button type="button" className="admin-button" onClick={() => { setNotice(""); setCreating(true); }}>Add user</button></>}
    >
      {notice && <p className="admin-note success" role="status">{notice}</p>}


      <AdminState loading={loading} error={error} onRetry={reload} empty={!data?.items.length}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <label className="admin-search">
            <span>Search people</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, employee code, or mobile" />
          </label>
          <label className="admin-select">
            <span>Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
              <option value="all">All roles</option>
              <option value="rm">Regional managers</option>
              <option value="salesperson">Salespeople</option>
            </select>
          </label>
          <label className="admin-select">
            <span>Sort by</span>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="rm-first">RMs first, then salespeople</option>
              <option value="salesperson-first">Salespeople first, then RMs</option>
            </select>
          </label>
          <span style={{ color: "var(--a-muted)", fontSize: 12, paddingBottom: 10 }}>{accounts.total} {accounts.total === 1 ? "person" : "people"}</span>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="admin-placeholder" role="status">
            No people match this search and role.
            <button type="button" className="admin-button ghost small" onClick={() => { setSearch(""); setRoleFilter("all"); }}>Clear search and role filter</button>
          </div>
        ) : <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Person</th><th>Role</th><th>Reports to</th><th>Region / territory</th>
                  <th className="numeric">Monthly target</th><th className="numeric">Visits</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {accounts.rows.map((user) => (
                  <tr key={user.id} className={user.active ? undefined : "is-inactive"}>
                    <td>
                      <strong className="admin-cell-title">{user.fullName ?? user.email}</strong>
                      <small>{user.email}{user.loginId ? ` · Login ID: ${user.loginId}` : ""}{user.employeeCode ? ` · ${user.employeeCode}` : ""}{user.mobileNumber ? ` · ${user.mobileNumber}` : ""}</small>
                    </td>
                    <td><span className="admin-tag">{ROLE_LABEL[user.role]}</span></td>
                    <td>{user.managerName || "—"}</td>
                    <td>{user.region || "—"}<small>{user.territory || ""}</small></td>
                    <td className="numeric">{user.monthlyTarget ? `₹${user.monthlyTarget} Cr` : "—"}</td>
                    <td className="numeric">{formatNumber(user.visitCount)}</td>
                    <td>
                      <span className={`admin-pill ${user.active ? "positive" : "negative"}`}>{user.active ? "Active" : user.invitationPending ? "Invitation pending" : "Inactive"}</span>
                      <small>{user.activeSessions > 0 ? `${user.activeSessions} active session${user.activeSessions > 1 ? "s" : ""}` : `Added ${formatDate(user.createdAt)}`}</small>
                      {!user.active && user.invitationEmailStatus && <small>{INVITATION_STATUS[user.invitationEmailStatus]}</small>}
                    </td>
                    <td className="numeric">
                      <button type="button" className="admin-button ghost small" onClick={() => { setNotice(""); setEditing(user); }}>Manage</button>
                      {user.id !== data?.currentUserId && <button type="button" className="admin-button danger small" style={{ marginLeft: 8 }} onClick={() => { setNotice(""); setDeleting(user); }}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager pagination={accounts} label="accounts" />
        </>}
      </AdminState>


      {creating && <CreateUserDialog managers={data?.managers ?? []} onClose={() => setCreating(false)} onCreated={(email, emailRequested) => afterChange(`Account created for ${email}. The initial password works immediately. ${emailRequested ? "Review the account email status in Manage." : "No email was sent."}`)} />}
      {editing && <ManageUserDialog user={editing} managers={data?.managers ?? []} onClose={() => setEditing(null)} onSaved={afterChange} />}
      {deleting && <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} onDeleted={() => afterChange(`Deleted the sign-in account for ${deleting.email}. CRM history has been preserved.`)} />}
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

type ManagerOption = { id: string; fullName: string; email: string };

function ManagerField({ managers, selected }: { managers: ManagerOption[]; selected?: string | null }) {
  return <Field label="Reports to RM">
    <select name="managerUserId" defaultValue={selected ?? ""} required>
      <option value="">Select an RM…</option>
      {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName} · {manager.email}</option>)}
    </select>
  </Field>;
}

function CreateUserDialog({ managers, onClose, onCreated }: { managers: ManagerOption[]; onClose: () => void; onCreated: (email: string, emailRequested?: boolean) => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<UserRole>("salesperson");
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [createdUser, setCreatedUser] = useState<AdminUser | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [emailRequested, setEmailRequested] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const finish = () => { if (!saving) { if (createdUser) onCreated(createdUser.email, emailRequested); else onClose(); } };
  async function requestAccountEmail(user: AdminUser, passwordToEmail = emailPassword) {
    setEmailNotice(""); setEmailRequested(true);
    try {
      const { email } = await adminApi.sendAccountEmail(user.id, passwordToEmail || undefined);
      if (email.sent || email.deliveryStatus === "queued" || email.deliveryStatus === "processing") setEmailPassword("");
      setEmailNotice(email.sent
        ? email.passwordIncluded
          ? "Account email accepted by the provider. It includes the employee details, Login ID and initial password. Inbox delivery is not confirmed."
          : email.setupLinkIncluded === false
          ? "Account email accepted by Gmail/provider; delivery is not confirmed. It includes the Login ID. No password or localhost link was sent. Share the initial password privately; a setup link can be sent once remote CRM access is configured."
          : "Email accepted by the provider; delivery is not confirmed. The password setup link expires in 15 minutes."
        : email.reason === "cooldown" || email.reason === "delivery_pending"
          ? email.previousDeliveryStatus === "accepted" || email.previousDeliveryStatus === "sent"
            ? "Your previous account email was already accepted by the email provider. Check the employee's Inbox and Spam folder; inbox delivery is not confirmed. No duplicate was sent. Wait 60 seconds before requesting another email."
            : email.previousDeliveryStatus === "delivered"
              ? "The provider confirmed delivery of your previous account email. No duplicate was sent."
              : `Previous email status: ${email.previousDeliveryStatus || email.deliveryStatus || "unknown"}. Another request is blocked temporarily to avoid duplicates. Wait 60 seconds and check email status before retrying.`
        : email.reason === "local_link_restricted"
          ? "Not sent: localhost links can only go to the configured local test recipient. Set a reachable CRM URL before emailing employees on other devices."
          : email.reason === "email_not_configured"
            ? "Not sent: email configuration is incomplete. Check the configured email provider settings."
            : `Email status: ${email.deliveryStatus || "unknown"} (${email.reason || "check provider status"}). Check the status before retrying.`);
    } catch (cause) { setEmailNotice(cause instanceof ApiError && cause.status < 500 ? cause.message : "Email status is uncertain. Check the account email status in Manage before retrying."); }
    finally { setConfirmEmail(false); }
  }
  async function sendCreatedAccountEmail() {
    if (!createdUser || !confirmEmail) return;
    setSaving(true);
    try { await requestAccountEmail(createdUser); }
    finally { setSaving(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const sendEmail = submitter instanceof HTMLButtonElement && submitter.value === "send-account-email";
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const initialPassword = String(form.get("initialPassword") || "");
    if (initialPassword !== String(form.get("confirmPassword") || "")) {
      setError("The passwords do not match");
      setSaving(false);
      return;
    }
    try {
      const { user } = await adminApi.createUser({
        email,
        role: String(form.get("role")) as UserRole,
        initialPassword,
        loginId: String(form.get("loginId") || "").trim(),
        managerUserId: String(form.get("managerUserId") || "") || null,
        fullName: String(form.get("fullName")),
        mobileNumber: String(form.get("mobileNumber") || "").trim() || undefined,
        employeeCode: String(form.get("employeeCode") || "") || undefined,
        region: String(form.get("region") || "") || undefined,
        territory: String(form.get("territory") || "") || undefined,
        monthlyTarget: Number(form.get("monthlyTarget") || 0),
      });
      setCreatedUser(user);
      setEmailPassword(initialPassword);
      if (sendEmail && user.role !== "admin") await requestAccountEmail(user, initialPassword);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create this user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={createdUser ? "User created" : "Add a user"} onClose={finish}>
      {createdUser ? <section className="admin-form">
        <p className="admin-note success" role="status">Account created for {createdUser.fullName || createdUser.email}. {emailRequested ? "See the email result below." : "No email has been sent. You can approve sending below."}</p>
        <p><strong>Login ID:</strong> {createdUser.loginId}<br /><strong>Email:</strong> {createdUser.email}</p>
        <p className="admin-note subtle">The account email includes Login ID, email address and all saved employee details. The password entered below will also be emailed. CRM access and optional password setup links are included when a usable CRM URL is configured.</p>
        {createdUser.role !== "admin" && <>
          <Field label="Current password to include in email" hint="Stored passwords cannot be recovered. Leave blank to send employee details without a password."><input type="password" autoComplete="off" maxLength={200} value={emailPassword} disabled={saving} onChange={event => setEmailPassword(event.target.value)} /></Field>
          <label><input type="checkbox" checked={confirmEmail} disabled={saving} onChange={event => setConfirmEmail(event.target.checked)} /> I approve sending an account email to {createdUser.email}.</label>
          <button type="button" className="admin-button" disabled={saving || !confirmEmail} onClick={sendCreatedAccountEmail}>{saving ? "Sending..." : "Send Account Email"}</button>
        </>}
        {emailNotice && <p className="admin-note subtle" role="status">{emailNotice}</p>}
        <div className="admin-dialog-actions"><button type="button" className="admin-button ghost" disabled={saving} onClick={finish}>Done</button></div>
      </section> : <form onSubmit={submit} className="admin-form">
        <Field label="Full name"><input name="fullName" required minLength={2} placeholder="Ketan Bhatt" /></Field>
        <Field label="Login ID" hint="3 to 64 letters, numbers, dots, underscores or hyphens. Case insensitive."><input name="loginId" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*" autoComplete="off" /></Field>
        <Field label="Work email"><input name="email" type="email" required placeholder="name@psspl.com" /></Field>
        <Field label="Mobile number" hint="Include country code if needed, for example +91 98765 43210."><input name="mobileNumber" type="tel" autoComplete="tel" maxLength={25} placeholder="+91 98765 43210" /></Field>
        <Field label="Role">
          <select name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="salesperson">Salesperson</option>
            <option value="rm">Regional manager</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
        <>
          <p className="admin-note subtle">The account can sign in immediately. Choose Create user & Send Email below to email the entered initial password, Login ID and all employee details to the email entered above. A secure password setup link is included when a usable CRM URL is configured. Create user saves the account without sending an email.</p>
          <Field label="Initial password" hint="At least 12 characters. Stored as a secure hash.">
            <div style={{ position: "relative" }}>
              <input name="initialPassword" type={showInitialPassword ? "text" : "password"} required minLength={12} maxLength={200} autoComplete="new-password" style={{ paddingRight: 48 }} />
              <PasswordVisibilityButton visible={showInitialPassword} onClick={() => setShowInitialPassword((value) => !value)} />
            </div>
          </Field>
          <Field label="Confirm initial password">
            <div style={{ position: "relative" }}>
              <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required minLength={12} maxLength={200} autoComplete="new-password" style={{ paddingRight: 48 }} />
              <PasswordVisibilityButton visible={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)} />
            </div>
          </Field>
        </>
        {role === "salesperson" && <ManagerField managers={managers} />}
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
          <button type="button" className="admin-button ghost" onClick={finish} disabled={saving}>Cancel</button>
          <button type="submit" className="admin-button ghost" disabled={saving}>{saving ? "Saving..." : "Create user"}</button>
          {role !== "admin" && <button type="submit" name="action" value="send-account-email" className="admin-button" disabled={saving}>{saving ? "Saving..." : "Create user & Send Email"}</button>}
        </div>
      </form>}
    </Dialog>
  );
}

function PasswordVisibilityButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return <button
    type="button"
    onClick={onClick}
    aria-label={visible ? "Hide password" : "Show password"}
    aria-pressed={visible}
    title={visible ? "Hide password" : "Show password"}
    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", padding: 6, border: 0, background: "transparent", color: "var(--a-muted)", cursor: "pointer" }}
  >
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {visible ? <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 3l18 18" /><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a14.8 14.8 0 0 1-3.1 3.8M6.2 6.2C3.5 8.1 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>}
    </svg>
  </button>;
}

function ManageUserDialog({ user, managers, onClose, onSaved }: { user: AdminUser; managers: ManagerOption[]; onClose: () => void; onSaved: (message: string) => void }) {
  const [error, setError] = useState("");
  const [accountEmailStatus, setAccountEmailStatus] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [confirmAccountEmail, setConfirmAccountEmail] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user.role);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await adminApi.updateUser(user.id, {
        fullName: String(form.get("fullName")),
        mobileNumber: String(form.get("mobileNumber") || "").trim(),
        role: String(form.get("role")) as UserRole,
        managerUserId: String(form.get("managerUserId") || "") || null,
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

  async function resendInvitation() {
    setError(""); setInvitationStatus(""); setSaving(true);
    try {
      const result = await adminApi.sendInvitation(user.id);
      if (result.invitation.sent) {
        onSaved(`Resend accepted a new invitation email for ${user.email}; delivery is not confirmed yet.`);
      } else if (result.invitation.reason === "email_not_configured" || result.invitation.deliveryStatus === "not_configured") {
        setInvitationStatus("No invitation was sent. Configure Resend email delivery in the backend environment and restart the API before trying again.");
      } else if (result.invitation.reason === "cooldown") {
        setInvitationStatus("An invitation was requested recently. Wait a minute before trying again.");
      } else if (["queued", "processing"].includes(result.invitation.deliveryStatus ?? "")) {
        setInvitationStatus("The invitation is queued. Check its delivery status before trying again.");
      } else if (result.invitation.deliveryStatus === "unknown") {
        setInvitationStatus("Email delivery is uncertain. Check Resend before sending another invitation.");
      } else {
        setInvitationStatus(`Invitation was not accepted (${result.invitation.reason ?? "delivery unavailable"}). Check email configuration and delivery status before trying again.`);
      }
    } catch {
      setInvitationStatus("Invitation status is uncertain. Refresh Users & access and check its email status before trying again; it may already be queued or accepted.");
    }
    finally { setSaving(false); }
  }

  async function sendAccountEmail() {
    setSaving(true); setError(""); setAccountEmailStatus("");
    try {
      const { email } = await adminApi.sendAccountEmail(user.id, emailPassword || undefined);
      if (email.sent || email.deliveryStatus === "queued" || email.deliveryStatus === "processing") setEmailPassword("");
      setAccountEmailStatus(email.sent
        ? email.passwordIncluded
          ? "Account email accepted by the provider. It includes the employee details, Login ID and supplied password. Inbox delivery is not confirmed."
          : email.setupLinkIncluded === false
          ? "Account email accepted by Gmail/provider; delivery is not confirmed. It includes the Login ID. No password or localhost link was sent. Share the initial password privately; a setup link can be sent once remote CRM access is configured."
          : "Email accepted by the provider; delivery is not confirmed. The password setup link expires in 15 minutes."
        : email.reason === "cooldown" || email.reason === "delivery_pending"
          ? email.previousDeliveryStatus === "accepted" || email.previousDeliveryStatus === "sent"
            ? "Your previous account email was already accepted by the email provider. Check the employee's Inbox and Spam folder; inbox delivery is not confirmed. No duplicate was sent. Wait 60 seconds before requesting another email."
            : email.previousDeliveryStatus === "delivered"
              ? "The provider confirmed delivery of your previous account email. No duplicate was sent."
              : `Previous email status: ${email.previousDeliveryStatus || email.deliveryStatus || "unknown"}. Another request is blocked temporarily to avoid duplicates. Wait 60 seconds and check email status before retrying.`
        : email.reason === "local_link_restricted"
          ? "Not sent: localhost links are restricted to the configured local test recipient. Set a reachable CRM URL before emailing employees on other devices."
          : email.reason === "email_not_configured"
            ? "Not sent: configure the email provider, CRM URL and encrypted queue key in the backend."
            : email.reason === "cooldown" || email.reason === "delivery_pending"
              ? "An account or password reset email was requested recently or is pending. Wait before trying again."
              : `Email status: ${email.deliveryStatus || "unknown"} (${email.reason || "check provider status"}). Provider acceptance does not confirm delivery.`);
    } catch (cause) { setAccountEmailStatus(cause instanceof ApiError && cause.status < 500 ? cause.message : "Email status is uncertain. Refresh the account and check its email status before retrying."); }
    finally { setSaving(false); setConfirmAccountEmail(false); }
  }

  async function resetPassword() {
    setError("");
    if (password.length < 12) { setError("Password must be at least 12 characters"); return; }
    setSaving(true);
    try {
      await adminApi.resetPassword(user.id, password);
      onSaved(`Password reset for ${user.email}. All sessions were signed out.`);
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
        <Field label="Mobile number" hint="Include country code if needed, for example +91 98765 43210."><input name="mobileNumber" type="tel" autoComplete="tel" maxLength={25} defaultValue={user.mobileNumber ?? ""} /></Field>
        <Field label="Role">
          <select name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="salesperson">Salesperson</option>
            <option value="rm">Regional manager</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
        {role === "salesperson" && <ManagerField managers={managers} selected={user.managerUserId} />}
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

      {user.active && (user.role === "rm" || user.role === "salesperson") && <section className="admin-form">
        <h3>Account email</h3>
        <p className="admin-note subtle">Send all saved employee details and Login ID. Enter the current password below to include it in the email. The CRM verifies it before sending and does not change the password. Optional setup links are included when a usable CRM URL is configured.</p>
        {user.accountEmailStatus && <p className="admin-note subtle">Latest account / reset email: {INVITATION_STATUS[user.accountEmailStatus]}</p>}
        <Field label="Current password to include in email" hint="Existing passwords cannot be shown. Re-enter the current password, or leave blank to email details only."><input type="password" autoComplete="off" maxLength={200} value={emailPassword} disabled={saving} onChange={event => setEmailPassword(event.target.value)} /></Field>
        <label><input type="checkbox" checked={confirmAccountEmail} disabled={saving} onChange={event => setConfirmAccountEmail(event.target.checked)} /> I approve sending an account email to {user.email}.</label>
        <div className="admin-dialog-actions left"><button type="button" className="admin-button" onClick={sendAccountEmail} disabled={saving || !confirmAccountEmail}>Send Account Email</button></div>
        {accountEmailStatus && <p className="admin-note subtle" role="status">{accountEmailStatus}</p>}
      </section>}

      {!user.active && <section className="admin-form">
        <h3>Account invitation</h3>
        <p className="admin-note subtle">{user.invitationPending ? "This account has not been activated. Resending invalidates the previous invitation link." : user.invitationEmailStatus ? "No active invitation link is recorded. Review the latest email status before resending." : "This account has not been invited yet. Send an invitation after email delivery is configured."}</p>
        {user.invitationEmailStatus && <p className="admin-note subtle">Latest email status: {INVITATION_STATUS[user.invitationEmailStatus]}</p>}
        {invitationStatus && <p className="admin-error" role="alert">{invitationStatus}</p>}
        <div className="admin-dialog-actions left"><button type="button" className="admin-button ghost" onClick={resendInvitation} disabled={saving}>Resend invitation</button></div>
      </section>}

      <hr className="admin-divider" />

      <section className="admin-form">
        <h3>Password</h3>
        <p className="admin-note subtle">Existing passwords cannot be shown. Enter a new password to replace one.</p>
        <Field label="Set a new password" hint="At least 12 characters. Signs the person out of all devices.">
          <input type="password" autoComplete="new-password" maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" />
        </Field>
        <div className="admin-dialog-actions left">
          <button type="button" className="admin-button ghost" onClick={resetPassword} disabled={saving || password.length < 12}>Reset password</button>
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

function DeleteUserDialog({ user, onClose, onDeleted }: { user: AdminUser; onClose: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    try { await adminApi.deleteUser(user.id, confirmation); onDeleted(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete this account"); }
    finally { setSaving(false); }
  }
  return <Dialog title="Delete person" onClose={() => { if (!saving) onClose(); }}>
    <p>Delete the sign-in account for <strong>{user.fullName ?? user.email}</strong> ({user.email})?</p>
    <p>This removes the person from Users &amp; access and revokes their sessions and invitation/reset links. Their visits, leads, customer records and historical name remain recorded. An administrator can restore the account from Archived employees by setting new sign-in credentials.</p>
    <p>Existing customer ownership stays recorded. Reassign customers in Customers if another employee needs access. Any reporting employees must be reassigned before deletion.</p>
    <form className="admin-form" onSubmit={submit}>
      <Field label="Type their email to confirm"><input type="email" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required disabled={saving} /></Field>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-dialog-actions">
        <button type="button" className="admin-button ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="admin-button danger" disabled={saving || confirmation.trim().toLowerCase() !== user.email.toLowerCase()}>{saving ? "Deleting…" : "Delete account"}</button>
      </div>
    </form>
  </Dialog>;
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
