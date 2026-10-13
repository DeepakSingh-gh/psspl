export type UserRole = "salesperson" | "rm" | "admin";

export interface SessionUser {
  id: string;
  email: string;
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
  thrustActiveCount?: number;
  thrustTopProduct?: string | null;
}

export interface ThrustLeaderboardItem {
  id: string;
  name: string;
  region: string | null;
  thrustSalesLakh: number;
  thrustSalesValue: number;
  thrustActiveCount: number;
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

export interface SalesReportResponse {
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

export interface ProductTrendsResponse {
  territories: TerritoryRow[];
  monthlyTrend: Array<{ period: string; salesValue: number; previousSalesValue: number; quantity: number; invoiceCount: number; productCount: number; changePercent: number | null }>;
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
  regions?: Array<{ region: string; salesValue: number }>;
  changeValue?: number;
  customerCount?: number;
  averageRate?: number | null;
  previousAverageRate?: number | null;
  name: string; salesValue: number; previousSalesValue: number; quantity: number; previousQuantity: number; invoiceCount: number; growthPercent: number | null;
}

export interface AdminAlertsResponse {
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
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  employeeCode: string | null;
  fullName: string | null;
  region: string | null;
  territory: string | null;
  monthlyTarget: number | null;
  managerUserId: string | null;
  activeSessions: number;
  visitCount: number;
}

export interface UserListResponse {
  items: AdminUser[];
  roles: UserRole[];
  managers: Array<{ id: string; fullName: string; email: string }>;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  employeeCode?: string;
  region?: string;
  territory?: string;
  monthlyTarget?: number;
  managerUserId?: string | null;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "email" | "password">> & { active?: boolean };

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
