import type { AiAnswerPresentation } from "@/types/ai-answer";
import type { CompleteVisitPayload, LoginResponse, SalesDay } from "@/types/sales";
import type { RmFeedbackSummary, RmFeedbackSnapshot } from "@/types/rm-feedback";
import { feedAdminFeedback, feedRmFeedback } from "./rm-feedback-data";
import type {
  ArchivedEmployee,
  ArchivedHistoryResponse,
  ArchiveSection,
  ActivityResponse,
  AdminOverview,
  ManagementAttentionResponse,
  CreateUserPayload,
  CustomerDetail,
  CustomerListResponse,
  ProductDetail,
  ProductListResponse,
  SessionUser,
  SalesReportResponse,
  MovementResponse,
  ProductTrendsResponse,
  AdminAlertsResponse,
  SavedReport,
  AuditLogResponse,
  TallyAdminResponse,
  TeamResponse,
  UpdateUserPayload,
  UserListResponse,
} from "@/types/admin";

// Keep local browser traffic on the app origin. The Next dev server forwards
// /api to Express, avoiding browser restrictions on loopback/cross-origin calls.
const API_URL = process.env.NODE_ENV === "development"
  ? "/api"
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api");

const TOKEN_KEY = "psspl_crm_session";
const USER_KEY = "psspl_crm_user";
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function saveSession(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearSession() {
  if (typeof window === "undefined") return;
  const hadSession = localStorage.getItem(TOKEN_KEY) !== null || localStorage.getItem(USER_KEY) !== null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (hadSession) window.dispatchEvent(new Event("psspl:session-cleared"));
}
export function hasSession() { return typeof window !== "undefined" && Boolean(localStorage.getItem(TOKEN_KEY)); }

/** The signed-in user is cached only to pick the right landing area; the API still authorises every request. */
export function saveSessionUser(user: SessionUser) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(USER_KEY); return raw ? (JSON.parse(raw) as SessionUser) : null; }
  catch { return null; }
}
export function homePathFor(role: string | undefined) {
  if (role === "admin") return "/admin";
  if (role === "rm") return "/sales/my-day";
  return "/sales/my-day";
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function request<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const cookieText = typeof document !== "undefined" ? document.cookie : "";
  const csrf = cookieText.split(";").map((part) => part.trim()).find((part) => part.startsWith("psspl_csrf="))?.slice("psspl_csrf=".length);
  const unsafe = Boolean(init?.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase()));
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}), ...(unsafe && csrf ? { "X-CSRF-Token": csrf } : {}), ...init?.headers },
  });

  if (!response.ok) {
    const message = await response.json().catch(() => ({ error: "Request failed" }));
    if (authenticated && response.status === 401) clearSession();
    throw new ApiError(message.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  login: (value: string, password: string) => {
    const identifier = value.trim();
    // Preserve the email request contract for email entries and older API servers.
    const identity = identifier.includes("@") ? { email: identifier.toLowerCase() } : { loginId: identifier };
    return request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ ...identity, password }) }, false);
  },
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => request<{ ok: boolean }>("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) }),
  me: () => request<{ user: SessionUser }>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  requestPasswordReset: (email: string) => request<{ ok: boolean; message: string }>("/auth/password-reset", { method: "POST", body: JSON.stringify({ email }) }, false),
  completePasswordReset: (token: string, password: string) => request<{ ok: boolean }>("/auth/password-reset/complete", { method: "POST", body: JSON.stringify({ token, password }) }, false),
  activateAccount: (token: string, password: string) => request<{ ok: boolean }>("/auth/activate", { method: "POST", body: JSON.stringify({ token, password }) }, false),
};

export const adminApi = {
  rmFeedbackCatalog: () => request<{ items: RmFeedbackSummary[] }>("/admin/rm-feedback"),
  rmFeedback: (id: string) => request<RmFeedbackSnapshot>(`/admin/rm-feedback/${encodeURIComponent(id)}`),
  overview: (financialYear?: string) => request<AdminOverview>(`/admin/overview${query({ fy: financialYear })}`),
  team: (financialYear?: string) => request<TeamResponse>(`/admin/team${query({ fy: financialYear })}`),
  managementAttention: (financialYear?: string) => request<ManagementAttentionResponse>(`/admin/management-attention${query({ fy: financialYear })}`),
  salesReport: (from?: string, to?: string, filters: Record<string, string | undefined> = {}) => request<SalesReportResponse>(`/admin/reports/sales${query({ from, to, ...filters })}`),
  reportHistory: () => request<{ items: SavedReport[] }>("/admin/reports/history"),
  saveReport: (from: string, to: string, view: string, filters: Record<string, string> = {}) => request<SavedReport>("/admin/reports/history", { method: "POST", body: JSON.stringify({ from, to, view, filters }) }),
  productTrends: (financialYear?: string) => request<ProductTrendsResponse>(`/admin/product-trends${query({ fy: financialYear })}`),
  alerts: () => request<AdminAlertsResponse>("/admin/alerts"),
  audit: () => request<AuditLogResponse>("/admin/audit"),
  managementReports: (financialYear?: string) => request<any>(`/admin/management-reports${query({ fy: financialYear })}`),
  askAi: (question: string, from: string, to: string) => request<{ question: string; answer: string; from: string; to: string; source: string; presentation?: AiAnswerPresentation }>("/admin/ask-ai", { method: "POST", body: JSON.stringify({ question, from, to }) }),
  rmAiAnalysis: (id: string, from: string, to: string, period: string) => request<{ provider: string; items: any[] }>(`/admin/team/${encodeURIComponent(id)}/ai-analysis`, { method: "POST", body: JSON.stringify({ from, to, period }) }),
  customers: (params: { search?: string; rm?: string; type?: string; limit?: number; offset?: number } = {}) =>
    request<CustomerListResponse>(`/admin/customers${query(params)}`),
  customer: (id: string) => request<CustomerDetail>(`/admin/customers/${encodeURIComponent(id)}`),
  assignCustomerOwner: (id: string, ownerUserId: string | null) =>
    request<{ ok: boolean; customerId: string }>(`/admin/customers/${encodeURIComponent(id)}/owner`, { method: "PATCH", body: JSON.stringify({ ownerUserId }) }),
  assignCustomerOwners: (customerIds: string[], ownerUserId: string | null) =>
    request<{ ok: boolean; updated: number }>("/admin/customers/owners/bulk", { method: "PATCH", body: JSON.stringify({ customerIds, ownerUserId }) }),
  products: (params: { search?: string; limit?: number; offset?: number } = {}) =>
    request<ProductListResponse>(`/admin/products${query(params)}`),
  product: (id: string) => request<ProductDetail>(`/admin/products/${encodeURIComponent(id)}`),
  activity: () => request<ActivityResponse>("/admin/activity"),
  attendanceRevision: (signal?: AbortSignal) => request<{ revision: string }>("/admin/attendance/revision", { cache: "no-store", signal }),
  movement: (userId: string, date: string) => request<MovementResponse>(`/admin/activity/movement${query({ userId, date })}`),
  tally: () => request<TallyAdminResponse>("/admin/tally"),
  createTallyPairingCode: () => request<{ code: string; expiresAt: string }>("/admin/tally/pairing-code", { method: "POST" }),
  cancelTallyPairingCode: () => request<{ ok: boolean }>("/admin/tally/pairing-code", { method: "DELETE" }),
  revokeTallyConnector: () => request<{ ok: boolean }>("/admin/tally/connector/revoke", { method: "POST" }),
  users: () => request<UserListResponse>("/admin/users"),
  archivedUsers: () => request<{ items: ArchivedEmployee[] }>("/admin/archived-users"),
  restoreArchivedUser: (id: string, payload: { email: string; loginId: string; initialPassword: string; managerUserId?: string | null }) => request<{ ok: boolean }>(`/admin/archived-users/${encodeURIComponent(id)}/restore`, { method: "POST", body: JSON.stringify(payload) }),
  archivedUserHistory: (id: string, section: ArchiveSection, page = 1) => request<ArchivedHistoryResponse>(`/admin/archived-users/${encodeURIComponent(id)}/history${query({ section, page })}`),
  createUser: (payload: CreateUserPayload) => request<{ user: UserListResponse["items"][number] }>("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  emailStatus: () => request<{ configured: boolean; provider: string; queueConfigured: boolean; appUrl: string; localOnly: boolean; localTestRecipient: string; connectionStatus: string }>("/admin/email/status"),
  sendTestEmail: (recipient: string) => request<{ email: { accepted: boolean; deliveryStatus: string; reason?: string } }>("/admin/email/test", { method: "POST", body: JSON.stringify({ recipient, confirmSend: true }) }),
  sendAccountEmail: (id: string, initialPassword?: string) => request<{ email: { sent: boolean; deliveryStatus?: string; reason?: string; setupLinkIncluded?: boolean; passwordIncluded?: boolean; previousDeliveryStatus?: string } }>(`/admin/users/${encodeURIComponent(id)}/account-email`, { method: "POST", body: JSON.stringify({ confirmSend: true, ...(initialPassword ? { initialPassword } : {}) }) }),
  sendInvitation: (id: string) => request<{ invitation: { sent: boolean; reason?: string; deliveryStatus?: string } }>(`/admin/users/${encodeURIComponent(id)}/invitation`, { method: "POST" }),
  updateUser: (id: string, payload: UpdateUserPayload) =>
    request<{ user: UserListResponse["items"][number] }>(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteUser: (id: string, confirmEmail: string) => request<{ ok: boolean }>(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirmEmail }) }),
  resetPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/admin/users/${encodeURIComponent(id)}/password`, { method: "POST", body: JSON.stringify({ password }) }),
  sendWhatsApp: (reportId: string) => request<any>("/admin/reports/send-whatsapp", { method: "POST", body: JSON.stringify({ reportId }) }),
  rmDetail: async (id: string, from?: string, to?: string, feedbackPeriod?: string) => {
    const { feedbackSnapshot, ...data } = await request<any>(`/admin/team/${encodeURIComponent(id)}${query({ from, to, includeFeedback: feedbackPeriod ? "1" : undefined })}`);
    if (!feedbackPeriod || !data.feedbackSnapshotId) return data;
    const snapshot = feedbackSnapshot ?? await request<RmFeedbackSnapshot>(`/admin/rm-feedback/${encodeURIComponent(data.feedbackSnapshotId)}`);
    return feedAdminFeedback(data, snapshot, feedbackPeriod);
  },
  rmReportOptions: () => request<{ managers: Array<{ id: string; name: string }>; financialYears: string[] }>("/admin/rm-report-options"),
  rmPerformanceReport: (id: string, selection: import("../../shared/rm-report-period.mjs").RmReportSelection, salespersonId?: string) => request<import("../../shared/rm-performance.mjs").RmPerformanceReport>(`/admin/team/${encodeURIComponent(id)}${query({ ...selection, salespersonId:salespersonId||undefined, weekScheme: 'four', reportVersion: '2' })}`),
  rmPeriodReport: (id: string, selection: import("../../shared/rm-report-period.mjs").RmReportSelection) => request<any>(`/admin/team/${encodeURIComponent(id)}${query(selection)}`),
};

const pendingMyDay = new Map<string, Promise<SalesDay>>();

export const salesApi = {
  getMyDay: () => {
    const session = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) ?? "cookie" : "server";
    const pending = pendingMyDay.get(session);
    if (pending) return pending;
    const task = request<SalesDay>("/salespeople/me/my-day?view=workspace")
      .finally(() => { if (pendingMyDay.get(session) === task) pendingMyDay.delete(session); });
    pendingMyDay.set(session, task);
    return task;
  },
  checkIn: (position?: { latitude: number; longitude: number; accuracy?: number }) => request<SalesDay>("/salespeople/me/check-in", { method: "POST", body: JSON.stringify(position ?? {}) }),
  startVisit: (visitId: string, position?: { latitude: number; longitude: number; accuracy?: number }) => request<SalesDay>(`/visits/${visitId}/start`, { method: "POST", body: JSON.stringify(position ?? {}) }),
  deleteVisit: (visitId: string) => request<SalesDay>(`/visits/${visitId}`, { method: "DELETE" }),
  updateVisit: (visitId: string, payload: { purpose?: string; priority?: string; scheduledAt?: string }) => request<SalesDay>(`/visits/${visitId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  completeVisit: (visitId: string, payload: CompleteVisitPayload) =>
    request<SalesDay>(`/visits/${visitId}/complete`, { method: "POST", body: JSON.stringify(payload) }),
  toggleFollowUp: (id: string) =>
    request<SalesDay>(`/follow-ups/${id}/toggle`, { method: "PATCH" }),
  deleteFollowUp: (id: string) =>
    request<SalesDay>(`/follow-ups/${id}`, { method: "DELETE" }),
  updateFollowUp: (id: string, payload: { notes?: string; followUpType?: "call" | "visit"; completed?: boolean; priority?: string; dueDate?: string }) =>
    request<SalesDay>(`/follow-ups/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addFollowUp: (payload: { customerId: string; title: string; dueDate: string; priority?: string; followUpType?: "call" | "visit"; notes?: string }) =>
    request<SalesDay>("/follow-ups", { method: "POST", body: JSON.stringify(payload) }),
};

export const rmApi = {
  performanceReport: (selection: import("../../shared/rm-report-period.mjs").RmReportSelection, salespersonId?: string) => request<import("../../shared/rm-performance.mjs").RmPerformanceReport>(`/rm/period-report${query({ ...selection, salespersonId:salespersonId||undefined, weekScheme: 'four', reportVersion: '2' })}`),
  periodReport: (selection: import("../../shared/rm-report-period.mjs").RmReportSelection) => request<any>(`/rm/period-report${query(selection)}`),
  dashboard: (from?: string, to?: string) => request<any>(`/rm/dashboard${query({ from, to })}`),
  reportCard: async () => {
    const data = await request<any>("/rm/report-card");
    try { return feedRmFeedback(data, await request<RmFeedbackSnapshot>("/rm/print-report")); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return data; throw error; }
  },
  printReport: () => request<RmFeedbackSnapshot>("/rm/print-report"),
  customers: (q = "", page = 0) => request<{ total: number; items: any[] }>(`/rm/customers${query({ q, page })}`),
  customerDetail: (id: string) => request<any>(`/rm/customers/${encodeURIComponent(id)}`),
  saveDormantReason: (id: string, reason: string) => request<any>(`/rm/customers/${encodeURIComponent(id)}/dormant-reason`, { method: "POST", body: JSON.stringify({ reason }) }),
  productTrends: () => request<any>("/rm/product-trends"),
  alerts: () => request<any>("/rm/alerts"),
  askAi: (question: string) => request<any>("/rm/ask-ai", { method: "POST", body: JSON.stringify({ question }) }),
};

export const salesFeaturesApi = {
  customers: (q = "") => request<any[]>(`/sales/customers?q=${encodeURIComponent(q)}`),
  customer: (id: string) => request<any>(`/sales/customers/${id}`),
  addActivity: (payload: any) => request<any>("/sales/activities", { method: "POST", body: JSON.stringify(payload) }),
  addCall: (payload: { customerId: string; direction: "incoming" | "outgoing"; purpose: string; outcome: string; notes?: string; followUpDate?: string; occurredAt?: string }) => request<{ id: string; occurredAt: string; verifiedByTelephony: false }>("/sales/calls", { method: "POST", body: JSON.stringify(payload) }),
  leads: () => request<any[]>("/sales/leads"),
  leadAssignees: () => request<Array<{ userId: string; role: string; name: string }>>("/sales/leads/assignees"),
  leadConversionReport: () => request<{ total: number; won: number; lost: number; conversionPercent: number | null }>("/sales/leads/report/conversion"),
  assignLead: (id: string, userId: string) => request<any>(`/sales/leads/${id}/assignment`, { method: "PATCH", body: JSON.stringify({ userId }) }),
  leadDetail: (id: string) => request<any>(`/sales/leads/${id}`),
  addLead: (payload: any) => request<any>("/sales/leads", { method: "POST", body: JSON.stringify(payload) }),
  deleteLead: (id: string) => request<any>(`/sales/leads/${id}`, { method: "DELETE" }),
  setLeadStage: (id: string, stage: string) => request<any>(`/sales/leads/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
  requests: () => request<any[]>("/sales/requests"),
  addRequest: (payload: any) => request<any>("/sales/requests", { method: "POST", body: JSON.stringify(payload) }),
  setRequestStatus: (id: string, status: string) => request<any>(`/sales/requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  alerts: () => request<any>("/sales/alerts"),
  activityReport: (from: string, to: string) => request<any>(`/sales/reports/activity?from=${from}&to=${to}`),
  reportHistory: () => request<any[]>("/sales/reports/history"),
  askAi: (question: string) => request<any>("/sales/ask-ai", { method: "POST", body: JSON.stringify({ question }) }),
  checkOut: (payload?: { latitude: number; longitude: number; accuracy?: number }) => request<any>("/sales/attendance/check-out", { method: "POST", body: JSON.stringify(payload ?? {}) }),
  location: (payload: { latitude: number; longitude: number; accuracy?: number }) => request<any>("/sales/location", { method: "POST", body: JSON.stringify(payload) }),
  movement: (date?: string) => request<any>(`/sales/movement${date ? `?date=${date}` : ""}`),
  addUnplannedVisit: (payload: any) => request<any>("/sales/visits/unplanned", { method: "POST", body: JSON.stringify(payload) }),
  uploadVoiceNote: (visitId: string, blob: Blob, ext: string) => {
    const form = new FormData(); form.append("audio", blob, `note.${ext}`);
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    return fetch(`${API_URL}/sales/visits/${visitId}/voice-note`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }).then(async (r) => {
      const data = await r.json().catch(() => ({ error: "Voice note upload failed" }));
      if (!r.ok) { if (r.status === 401) clearSession(); throw new ApiError(data.error || "Voice note upload failed", r.status); }
      return data;
    });
  },
};

export async function transcribeSpeech(audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", audioBlob, "speech.webm");
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const response = await fetch(`${API_URL}/stt`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await response.json().catch(() => ({ error: "Transcription failed" }));
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(data.error || "Speech transcription failed");
  }
  return data.text || "";
}

