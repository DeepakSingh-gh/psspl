import type { CompleteVisitPayload, LoginResponse, SalesDay } from "@/types/sales";
import type {
  ActivityResponse,
  AdminOverview,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

const TOKEN_KEY = "psspl_crm_session";
const USER_KEY = "psspl_crm_user";
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function saveSession(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
export function hasSession() { return typeof window !== "undefined" && Boolean(localStorage.getItem(TOKEN_KEY)); }

/** The signed-in user is cached only to pick the right landing area; the API still authorises every request. */
export function saveSessionUser(user: SessionUser) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(USER_KEY); return raw ? (JSON.parse(raw) as SessionUser) : null; }
  catch { return null; }
}
export function homePathFor(role: string | undefined) { return role === "admin" ? "/admin" : role === "rm" ? "/rm" : "/sales/my-day"; }

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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });

  if (!response.ok) {
    const message = await response.json().catch(() => ({ error: "Request failed" }));
    throw new ApiError(message.error ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  me: () => request<{ user: SessionUser }>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

export const adminApi = {
  overview: (financialYear?: string) => request<AdminOverview>(`/admin/overview${query({ fy: financialYear })}`),
  team: (financialYear?: string) => request<TeamResponse>(`/admin/team${query({ fy: financialYear })}`),
  salesReport: (from?: string, to?: string) => request<SalesReportResponse>(`/admin/reports/sales${query({ from, to })}`),
  reportHistory: () => request<{ items: SavedReport[] }>("/admin/reports/history"),
  saveReport: (from: string, to: string, view: string) => request<SavedReport>("/admin/reports/history", { method: "POST", body: JSON.stringify({ from, to, view }) }),
  productTrends: (financialYear?: string) => request<ProductTrendsResponse>(`/admin/product-trends${query({ fy: financialYear })}`),
  alerts: () => request<AdminAlertsResponse>("/admin/alerts"),
  audit: () => request<AuditLogResponse>("/admin/audit"),
  managementReports: (financialYear?: string) => request<any>(`/admin/management-reports${query({ fy: financialYear })}`),
  askAi: (question: string, from: string, to: string) => request<{ question: string; answer: string; from: string; to: string; source: string }>("/admin/ask-ai", { method: "POST", body: JSON.stringify({ question, from, to }) }),
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
  movement: (userId: string, date: string) => request<MovementResponse>(`/admin/activity/movement${query({ userId, date })}`),
  tally: () => request<TallyAdminResponse>("/admin/tally"),
  createTallyPairingCode: () => request<{ code: string; expiresAt: string }>("/admin/tally/pairing-code", { method: "POST" }),
  cancelTallyPairingCode: () => request<{ ok: boolean }>("/admin/tally/pairing-code", { method: "DELETE" }),
  revokeTallyConnector: () => request<{ ok: boolean }>("/admin/tally/connector/revoke", { method: "POST" }),
  users: () => request<UserListResponse>("/admin/users"),
  createUser: (payload: CreateUserPayload) => request<{ user: UserListResponse["items"][number] }>("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: UpdateUserPayload) =>
    request<{ user: UserListResponse["items"][number] }>(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),
  resetPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/admin/users/${encodeURIComponent(id)}/password`, { method: "POST", body: JSON.stringify({ password }) }),
  sendWhatsApp: (reportId: string) => request<any>("/admin/reports/send-whatsapp", { method: "POST", body: JSON.stringify({ reportId }) }),
  rmDetail: (id: string, from?: string, to?: string) => request<any>(`/admin/team/${encodeURIComponent(id)}${query({ from, to })}`),
};

export const salesApi = {
  getMyDay: () => request<SalesDay>("/salespeople/me/my-day"),
  checkIn: (position?: { latitude: number; longitude: number }) => request<SalesDay>("/salespeople/me/check-in", { method: "POST", body: JSON.stringify(position ?? {}) }),
  startVisit: (visitId: string) => request<SalesDay>(`/visits/${visitId}/start`, { method: "POST" }),
  completeVisit: (visitId: string, payload: CompleteVisitPayload) =>
    request<SalesDay>(`/visits/${visitId}/complete`, { method: "POST", body: JSON.stringify(payload) }),
  toggleFollowUp: (id: string) =>
    request<SalesDay>(`/follow-ups/${id}/toggle`, { method: "PATCH" }),
};

export const rmApi = {
  dashboard: (from?: string, to?: string) => request<any>(`/rm/dashboard${query({ from, to })}`),
  reportCard: () => request<any>("/rm/report-card"),
  customers: (q = "", page = 0) => request<{ total: number; items: any[] }>(`/rm/customers${query({ q, page })}`),
  customerDetail: (id: string) => request<any>(`/rm/customers/${encodeURIComponent(id)}`),
  productTrends: () => request<any>("/rm/product-trends"),
  alerts: () => request<any>("/rm/alerts"),
  askAi: (question: string) => request<any>("/rm/ask-ai", { method: "POST", body: JSON.stringify({ question }) }),
};

export const salesFeaturesApi = {
  customers: (q = "") => request<any[]>(`/sales/customers?q=${encodeURIComponent(q)}`),
  customer: (id: string) => request<any>(`/sales/customers/${id}`),
  addActivity: (payload: any) => request<any>("/sales/activities", { method: "POST", body: JSON.stringify(payload) }),
  leads: () => request<any[]>("/sales/leads"),
  leadDetail: (id: string) => request<any>(`/sales/leads/${id}`),
  addLead: (payload: any) => request<any>("/sales/leads", { method: "POST", body: JSON.stringify(payload) }),
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
    return fetch(`${API_URL}/sales/visits/${visitId}/voice-note`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }).then((r) => r.json());
  },
};
