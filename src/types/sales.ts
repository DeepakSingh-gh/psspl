import type { SessionUser } from "./admin";

export type VisitStatus = "planned" | "in_progress" | "completed";

export interface Visit {
  id: string;
  customerId: string;
  customer: string;
  location: string;
  time: string;
  productId: string | null;
  product: string;
  purpose: string;
  status: VisitStatus;
  priority?: string;
}

export type FollowUpType = "call" | "visit";

export interface FollowUp {
  id: string;
  title: string;
  customer: string;
  dueLabel: string;
  priority: "high" | "medium" | "low" | "today" | "overdue" | string;
  completed: boolean;
  followUpType?: FollowUpType;
  notes?: string;
}

export interface SalesDay {
  salesperson: { id: string; email: string; name: string; region: string; territory: string; checkedInAt: string | null; checkedOutAt: string | null; trackingActive: boolean };
  visits: Visit[];
  followUps: FollowUp[];
  performance: { actual: number; target: number; currencyLabel: string };
  summary: { expectedOrderValue: number; expectedOrderCount: number; followUpsCreated: number; productsDiscussed: number };
  tally: { mode: string; connected: boolean; lastSyncAt: string | null; message?: string };
  referenceData: { customers: TallyCustomer[]; products: TallyProduct[] };
  insights: { customerCount: number; totalOutstanding: number; topProducts: Array<{ name: string; salesValue: number; quantity: number }>; decliningProducts: Array<{ name: string; previousSales: number; currentSales: number; difference: number }> };
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
export interface LoginResponse { token: string; expiresAt: string; user: SessionUser; }
