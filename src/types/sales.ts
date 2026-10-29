import type { SessionUser } from "./admin";

export type VisitStatus = "planned" | "in_progress" | "completed";

export interface Visit {
  id: string;
  customerId: string;
  customer: string;
  location: string;
  time: string;
  dateLabel?: string;
  nextFollowUpDate?: string;
  productId: string | null;
  product: string;
  purpose: string;
  status: VisitStatus;
  priority?: string;
  notes?: string;
  voiceNoteAvailable?: boolean;
}

export type FollowUpType = "call" | "visit";

export interface FollowUp {
  id: string;
  title: string;
  customer: string;
  dueLabel: string;
  dueDate?: string;
  priority: "high" | "medium" | "low" | "today" | "overdue" | string;
  completed: boolean;
  followUpType?: FollowUpType;
  notes?: string;
}

export interface SalesDay {
  salesperson: {
    id: string;
    role?: SessionUser["role"];
    email: string;
    name: string;
    region: string;
    territory: string;
    employeeCode?: string | null;
    managerName?: string | null;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    trackingActive: boolean;
  };
  visits: Visit[];
  followUps: FollowUp[];
  performance: {
    actual: number;
    target: number;
    currencyLabel: string;
    achievement?: number;
    periodLabel?: string;
    actualRupees?: number;
    targetRupees?: number;
  };
  summary: { expectedOrderValue: number; expectedOrderCount: number; followUpsCreated: number; productsDiscussed: number; plannedVisits: number; completedVisits: number; pendingVisits: number; loggedCalls: number; pendingFollowUps: number; overdueActivities: number; completedActivities: number; expectedOrderValueToday: number; expectedOrderCountToday: number; attendanceStatus: "not_checked_in" | "checked_in" | "checked_out" };
  calls: Array<{ id: string; customer: string; direction: "incoming" | "outgoing" | "unspecified"; purpose: string; notes: string | null; occurredAt: string }>;
  attendanceHistory: Array<{ businessDate: string; checkInAt: string; checkOutAt: string | null; latitude: number | null; longitude: number | null; gpsAccuracyMeters: number | null }>;
  tally: { mode: string; connected: boolean; lastSyncAt: string | null; message?: string };
  referenceData: { customers: TallyCustomer[]; products: Pick<TallyProduct, "id" | "name">[] };
  insights?: { customerCount: number; totalOutstanding: number; topProducts: Array<{ name: string; salesValue: number; quantity: number }>; decliningProducts: Array<{ name: string; previousSales: number; currentSales: number; difference: number }> };
}

export interface CompleteVisitPayload {
  productId: string;
  outcome: string;
  expectedOrderValue: number;
  expectedOrderDate?: string;
  nextFollowUp: string;
  nextFollowUpType?: FollowUpType;
  nextFollowUpNotes?: string;
  notes?: string;
}

export interface TallyCustomer { id: string; name: string; city: string; type: string; }
export interface TallyProduct { id: string; name: string; group: string; }
export interface LoginResponse { token?: string; expiresAt: string; user: SessionUser; }
