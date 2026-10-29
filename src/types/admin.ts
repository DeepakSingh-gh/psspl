export type UserRole = "salesperson" | "rm" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  loginId?: string | null;
  role: UserRole;
}

export interface TallyStatus {
  mode: string;
  connected: boolean;
  lastSyncAt: string | null;
  message?: string;
}

export interface AdminOverview {
  financialYear: string | null;
  financialYears: string[];
  sales: { actual: number; target: number; hasTargets: boolean; rmCount: number };
  customers: { count: number; lifetimeSales: number; outstanding: number; unassigned: number };
  collections: { receiptCount: number; receiptValue: number };
  products: { count: number; lifetimeValue: number };
  users: { total: number; active: number; admins: number; rms: number; salespeople: number };
  fieldActivity: {
    visitsTotal: number;
    visitsToday: number;
    visitsCompleted: number;
    followUpsTotal: number;
    followUpsOpen: number;
    checkedInToday: number;
  };
  leadPipeline: {
    total: number;
    stages: Array<{ stage: string; count: number; expectedValue: number }>;
    recent: Array<{ id: string; name: string; company: string | null; stage: string; expectedValue: number; createdAt: string; ownerName: string }>;
  };
  charts: {
    periodStart: string;
    periodEnd: string;
    monthlySales: Array<{ period: string; salesValue: number; invoiceCount: number }>;
    productSales: Array<{ name: string; salesValue: number; quantity: number }>;
    territorySales: Array<{ name: string; salesValue: number; customerCount: number }>;
    teamPerformance: Array<{ name: string; salesValue: number; targetValue: number; achievementPercent: number | null }>;
    salespersonLocations: Array<{ userId: string; email: string; fullName: string; region: string | null; territory: string | null; checkInAt: string | null; checkOutAt: string | null; latitude: number | null; longitude: number | null; lastLocationAt: string | null }>;
  };
  tally: TallyStatus;
}

export interface TeamMember {
  id: string;
  name: string;
  aliases: string[];
  sources: string[];
  targetValue: number;
  monthlyTargetValue: number;
  salesValue: number;
  previousSalesValue: number;
  customerCount: number;
  outstanding: number;
  salespeopleCount: number;
  topProduct: { name: string; salesValue: number; quantity: number } | null;
  achievementPercent: number | null;
  growthPercent: number | null;
  visitsTotal: number;
  visitsCompleted: number;
  followUpsOpen: number;
  checkedInToday: boolean;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  crmUser: { id: string; email: string; role: UserRole; active: boolean } | null;
  thrustSalesValue?: number;
  thrustSalesLakh?: number;
  thrustActiveCount?: number | null;
  thrustTopProduct?: string | null;
  feedbackSnapshotId?: string | null;
  reportSource?: { kind: string; asOf: string; financialYear: string } | null;
  financialDataStatus?: "available" | "unavailable";
  historicalSales?: Array<{ financialYear: string; salesValue: number; source: string }>;
}

export interface ThrustLeaderboardItem {
  id: string;
  name: string;
  region: string | null;
  thrustSalesLakh: number;
  thrustSalesValue: number;
  thrustActiveCount: number | null;
  thrustTopProduct: string | null;
}

export interface TeamResponse {
  financialYear: string | null;
  financialYears: string[];
  targetMonths: number;
  members: TeamMember[];
  thrustLeaderboard?: ThrustLeaderboardItem[];
  unassignedCustomers: number;
  unassignedSalesValue: number;
  liveInvoiceCount: number;
  hasTargets: boolean;
}

export interface ManagementAttentionResponse {
  financialYear: string;
  period: { monthFrom: string; fyFrom: string; to: string };
  asOf: string;
  thresholds: { dormantDays: number; targetAlertPercent: number; concentrationAlertPercent: number; visitCompletionAlertPercent: number; provisional: boolean };
  team: Array<{
    id: string; name: string; ownershipMapping: "verified" | "unmapped" | "ambiguous";
    monthlyPerformance: { from: string; to: string; label: string; actual: number | null; target: number | null; achievementPercent: number | null };
    ytdPerformance: { from: string; to: string; label: string; actual: number | null; target: number | null; achievementPercent: number | null };
    concentrationPercent: number | null;
    concentrationTopDealers: Array<{ id: string; name: string; salesValue: number }>;
    actions: Array<{ id: string; kind: string; severity: string; rmId: string; rmName: string; metric: string; actual?: number | null; target?: number | null; period: { from: string; to: string }; title: string; action: string; href: string; thresholdsProvisional: boolean }>;
  }>;
  dealerActions: Array<{ id: string; kind: "dormant-dealer" | "declining-dealer"; severity: string; rmId: string; rmName: string; dealerId: string; dealerName: string; metric: string; title: string; period: { from: string; to: string }; action: string; href: string; reportHref: string; thresholdsProvisional: boolean }>;
  sync: { latestRun: { id: string; startedAt: string; completedAt: string | null; status: string; errorMessage: string | null } | null; needsReview: boolean };
  visits: {
    scheduledToday: number; completedToday: number;
    pastScheduled: Array<{ id: string; rmId: string | null; rmName: string; userId: string; ownerName: string; customerId: string; customerName: string; businessDate: string; scheduledAt: string; status: string; pastScheduledTime: boolean; pendingToday: boolean; action: string; href: string }>;
    pendingToday: Array<{ id: string; rmId: string | null; rmName: string; userId: string; ownerName: string; customerId: string; customerName: string; businessDate: string; scheduledAt: string; status: string; pastScheduledTime: boolean; pendingToday: boolean; action: string; href: string }>;
    byRm: Array<{ rmId: string | null; rmName: string; plannedToday: number; completedToday: number; pendingToday: number; pastScheduled: number }>;
  };
}

export interface SalesReportResponse {
  filters: Record<string, string>;
  from: string;
  to: string;
  summary: { totalSales: number; invoiceCount: number; customerCount: number; averageInvoice: number; repeatCustomers: number; repeatCustomerPercent: number; unallocatedProductSales: number; unallocatedProductInvoices: number };
  monthly: Array<{ period: string; salesValue: number; invoiceCount: number; customerCount: number }>;
  byProduct: Array<{ name: string; salesValue: number; quantity: number; invoiceCount: number }>;
  bySalesperson: Array<{ name: string; region: string; salesValue: number; invoiceCount: number; customerCount: number }>;
  byRegion: Array<{ name: string; salesValue: number; invoiceCount: number; customerCount: number }>;
  byCustomer: Array<{ name: string; salesValue: number; outstanding: number; invoiceCount: number }>;
}

export interface SavedReport {
  id: string; reportType: string; dateFrom: string; dateTo: string; createdAt: string;
  summary: { totalSales: number; invoiceCount: number; customerCount: number };
}

export interface AuditLogResponse {
  items: Array<{ id: string; userEmail: string; action: string; path: string; entityId: string | null; statusCode: number; details: Record<string, unknown>; ipAddress: string | null; userAgent: string | null; createdAt: string }>;
}

export interface ProductRecentMetric {
  name:string;paired:boolean;currentSales:number|null;previousSales:number|null;currentQuantity:number|null;previousQuantity:number|null;
  difference:number|null;growthPercent:number|null;fyContributionPercent:number|null;reason:string|null;
}
export interface ProductTrendReconciliation {
  reportedProductSales:number;invoiceLineSales:number;invoiceHeaderSales:number|null;headerLineDifference:number|null;invoicesWithoutLines:number|null;reason:string|null;
}
export interface RecentSalesComparison {
  available:true;reason:null;observedFrom:string;observedThrough:string;
  current:{from:string;to:string;label:string;sales:number};previous:{from:string;to:string;label:string;sales:number};
  label:string;difference:number;growthPercent:number|null;growthReason:string|null;decliningCount:number;
  gainers:ProductTrendRow[];losers:ProductTrendRow[];metrics:ProductRecentMetric[];
  lifecycle:{from:string;to:string;newlyObserved:{count:number;value:number;items:ProductTrendRow[]};noRecentSales:{count:number;value:number;items:ProductTrendRow[]};consistent:{count:number|null;months:number;reason:string|null};note:string};
  reconciliation:ProductTrendReconciliation;
}
export interface ProductTrendsResponse {
  recentComparison?:RecentSalesComparison|{available:false;reason:string;observedFrom:string|null;observedThrough:string|null;reconciliation:ProductTrendReconciliation};
  availability?: {source:string|null;previousSource:string|null;currentSales:boolean;previousSales:boolean;reason:string|null;previousReason:string|null;monthlyReason:string;territoryReason:string|null};
  territories: TerritoryRow[];
  monthlyTrend: Array<{ period: string; salesValue: number|null; previousSalesValue: number; previousInvoiceCount?: number; quantity: number|null; invoiceCount: number; productCount: number; changePercent: number | null }>;
  gainers: ProductTrendRow[];
  losers: ProductTrendRow[];
  concentration: { top5: number | null; top10: number | null; top20: number | null; sellingProducts: number };
  newProducts: { count: number; value: number; items: ProductTrendRow[] };
  stoppedProducts: { count: number; value: number; items: ProductTrendRow[] };
  financialYear: string;
  financialYears: string[];
  periodStart: string; periodEnd: string; previousStart: string; previousEnd: string;
  summary: { totalSales: number; previousTotalSales: number; growthPercent: number | null; activeProducts: number; decliningProducts: number };
  top: ProductTrendRow[]; slow: ProductTrendRow[]; declining: ProductTrendRow[];
  regions: Array<{ region: string; productName: string; salesValue: number; quantity: number }>;
}

export interface ProductTrendRow {
  observedWindowSales?:number;
  parentName?:string;parentKey?:string;packingSize?:string|null;masterIds?:string[];monthsSold?:number|null;currentAvailable?:boolean;previousAvailable?:boolean;source?:string|null;rateSource?:string|null;
  monthly?:Array<{period:string;quantity:number|null;salesValue:number|null;invoiceCount:number|null;source:string}>;
  byRm?:Array<{name:string;rmName:string;quantity:number;salesValue:number}>;
  unavailable?:Record<string,string|null>;
  regions?: Array<{ region: string; salesValue: number }>;
  changeValue?: number|null;
  customerCount?: number|null;
  averageRate?: number | null;
  previousAverageRate?: number | null;
  name: string; salesValue: number; previousSalesValue: number; quantity: number; previousQuantity: number; invoiceCount: number|null; growthPercent: number | null;
}

export interface AdminAlertsResponse {
  targetShortfallsAvailable?: boolean;
  reminders?: { followUps: { pending: number; dueToday: number }; visits: { upcoming: number; pastScheduled: number }; managementAttention: Array<{ id: string; rmName: string; title: string; metric: string; action: string; thresholdsProvisional: boolean }> };
  asOf: string;
  summary: { total: number; missedCheckIns: number; overdueFollowUps: number; overdueOrders: number; inactiveCustomers: number; targetShortfalls: number };
  missedCheckIns: Array<{ userId: string; email: string; fullName: string; region: string; territory: string; managerName: string | null }>;
  overdueFollowUps: Array<{ id: string; title: string; dueDate: string; priority: string; customer: string; email: string; fullName: string; daysOverdue: number }>;
  overdueOrders: Array<{ id: string; expectedDate: string; expectedValue: number; customer: string; product: string; email: string; fullName: string; daysOverdue: number }>;
  inactiveCustomers: Array<{ id: string; name: string; city: string; outstanding: number; ownerName: string; region: string; lastInvoiceDate: string | null; inactiveDays: number | null }>;
  targetShortfalls: Array<{ userId: string; email: string; fullName: string; region: string; monthlyTarget: number; salesValue: number; targetValue: number; achievedPercent: number; expectedPacePercent: number }>;
}

export interface AdminCustomer {
  id: string;
  name: string;
  type: string;
  rmName: string;
  ownerUserId: string | null;
  city: string;
  totalSales: number;
  outstanding: number;
  lastPaymentDate: string | null;
  rmId: string | null;
  rmAssigned: boolean;
}

export interface CustomerListResponse {
  total: number;
  items: AdminCustomer[];
  filters: { types: string[]; owners: Array<{ userId: string; name: string; role: UserRole; territory: string | null }> };
}

export interface CustomerDetail {
  customer: AdminCustomer & { rmCode: string | null; destinationCode: string | null; sourceFile: string | null; state: string | null; pincode: string | null; contactName: string | null; phone: string | null; email: string | null; gstin: string | null };
  monthly: Array<{ period: string; amount: number }>;
  payments: Array<{ id: string; paymentDate: string; paymentType: string; voucherNumber: string | null; amount: number; reference: string | null }>;
  invoices: Array<{ id: string; invoiceDate: string; voucherNumber: string | null; voucherType: string; amount: number; reference: string | null }>;
  visits: Array<{ id: string; businessDate: string; purpose: string; status: string; outcome: string | null; salesperson: string | null }>;
}

export interface AdminProduct {
  id: string;
  name: string;
  packingSize: string | null;
  uom: string | null;
  rate: number;
  totalQuantity: number;
  totalValue: number;
  frequency: number;
}

export interface ProductListResponse {
  total: number;
  items: AdminProduct[];
}

export interface ProductDetail {
  product: AdminProduct & { sourceFile: string | null };
  monthly: Array<{ period: string; quantity: number; salesValue: number }>;
  invoices: Array<{ id: string; invoiceDate: string; voucherNumber: string | null; customerName: string; quantity: number; rate: number; amount: number }>;
  byRm: Array<{ rmName: string; financialYear: string; quantity: number; salesValue: number }>;
}

export interface ActivityResponse {
  today: string;
  visits: Array<{
    id: string;
    businessDate: string;
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    customer: string;
    purpose: string;
    outcome: string | null;
    status: string;
    email: string;
    fullName: string | null;
  }>;
  followUps: Array<{
    id: string;
    title: string;
    dueDate: string;
    priority: string;
    completed: boolean;
    customer: string;
    email: string;
    fullName: string | null;
  }>;
  attendance: Array<{
    id: string;
    userId: string;
    businessDate: string;
    checkInAt: string;
    checkOutAt: string | null;
    latitude: number | null;
    longitude: number | null;
    movementPoints: number;
    lastLocationAt: string | null;
    email: string;
    fullName: string | null;
  }>;
}

export interface MovementResponse {
  userId: string;
  date: string;
  attendance: { checkInAt: string; checkOutAt: string | null; latitude: number | null; longitude: number | null; email: string; fullName: string | null };
  points: Array<{ latitude: number; longitude: number; accuracy: number | null; capturedAt: string; kind: "check_in" | "movement" }>;
  distanceKm: number;
}

export interface TallyAdminResponse {
  status: TallyStatus;
  connector: {
    id: string;
    machineName: string | null;
    tallyCompany: string | null;
    tallyVersion: string | null;
    status: "paired" | "online" | "offline";
    pairedAt: string;
    lastHeartbeatAt: string | null;
    lastSyncAt: string | null;
  } | null;
  pairing: { id: string; codeHint: string; createdAt: string; expiresAt: string } | null;
  tables: Array<{ label: string; table: string; rows: number }>;
  sources: string[];
  metadata: Array<{ key: string; value: string }>;
  coverage: Record<string, { start: string | null; end: string | null }>;
  directory: Array<{ id: string; name: string; keys: string[]; aliases: string[]; sources: string[] }>;
  placeholderOwners: Array<{ name: string; customers: number }>;
  reconciliation: {
    paymentsByType?: Array<{ type: string; count: number; value: number; firstDate: string | null; lastDate: string | null }>;
    status: "healthy" | "attention"; checkedAt: string; criticalIssues: number; missingCustomers: number; missingProducts: number; invoicesWithoutLines: number; ledgerOnlyVouchers: number; staleSyncRuns: number; unassignedCustomers: number;
    duplicateVouchers: Array<{ voucherGuid: string; count: number }>;
    reusedVoucherNumbers: Array<{ companyName: string; voucherType: string; voucherNumber: string; invoiceDate: string; count: number; distinctGuids: number }>;
    missingLineInvoices: Array<{ id: string; voucherNumber: string | null; invoiceDate: string; customerName: string; amount: number; voucherGuid: string | null }>;
    lineVariances: Array<{ id: string; voucherNumber: string; invoiceDate: string; customerName: string; invoiceValue: number; lineValue: number; variance: number }>;
    totals: { invoiceCount: number; invoiceValue: number; firstInvoiceDate: string | null; lastInvoiceDate: string | null; lineCount: number; lineValue: number; paymentCount: number; paymentValue: number; firstPaymentDate: string | null; lastPaymentDate: string | null };
  };
  syncRuns: Array<{ id: string; startedAt: string; completedAt: string | null; status: string; entityCountsJson: string | null; errorMessage: string | null }>;
}

export interface AdminUser {
  id: string;
  loginId: string | null;
  email: string;
  role: UserRole;
  active: boolean;
  invitationPending: boolean;
  accountEmailStatus?: AdminUser["invitationEmailStatus"];
  invitationEmailStatus: "not_configured" | "queued" | "processing" | "canceled" | "expired" | "accepted" | "sent" | "delivered" | "delivery_delayed" | "bounced" | "complained" | "failed" | "unknown" | "suppressed" | null;
  createdAt: string;
  employeeCode: string | null;
  fullName: string | null;
  mobileNumber: string | null;
  region: string | null;
  territory: string | null;
  monthlyTarget: number | null;
  managerUserId: string | null;
  managerName: string | null;
  activeSessions: number;
  visitCount: number;
}

export interface UserListResponse {
  currentUserId: string;
  items: AdminUser[];
  roles: UserRole[];
  managers: Array<{ id: string; fullName: string; email: string }>;
}

export type ArchiveSection = "visits" | "leads" | "followUps" | "attendance" | "activities" | "requests" | "customers" | "orders" | "reports";
export interface ArchivedEmployee {
  id: string;
  role: UserRole;
  deletedAt: string;
  fullName: string | null;
  employeeCode: string | null;
  region: string | null;
  territory: string | null;
  managerUserId: string | null;
  managerName: string | null;
  counts: Record<ArchiveSection, number>;
}
export interface ArchivedHistoryResponse {
  employee: ArchivedEmployee;
  section: ArchiveSection;
  items: Array<Record<string, string | number | null>>;
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface CreateUserPayload {
  loginId: string;
  email: string;
  role: UserRole;
  fullName: string;
  mobileNumber?: string;
  initialPassword: string;
  employeeCode?: string;
  region?: string;
  territory?: string;
  monthlyTarget?: number;
  managerUserId?: string | null;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "email" | "loginId" | "initialPassword">> & { active?: boolean };

export interface TerritoryRow {
  region: string;
  salesValue: number;
  previousSalesValue: number;
  quantity: number;
  customerCount: number;
  productCount: number;
  invoiceCount: number;
  changePercent: number | null;
  sharePercent: number | null;
  topProducts: Array<{ name: string; salesValue: number; quantity: number }>;
  topCustomers: Array<{ name: string; salesValue: number }>;
}
