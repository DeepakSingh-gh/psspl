/** Indian-format helpers shared by the admin console. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Rupee value in the unit Indian finance teams read: Cr above a crore, L above a lakh. */
export function formatRupees(value: number | null | undefined, options: { decimals?: number } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const decimals = options.decimals ?? 2;
  const sign = value < 0 ? "-" : "";
  const amount = Math.abs(value);
  if (amount >= 10000000) return `${sign}₹${(amount / 10000000).toFixed(decimals)} Cr`;
  if (amount >= 100000) return `${sign}₹${(amount / 100000).toFixed(decimals)} L`;
  return `${sign}₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value}%`;
}

/** "2024-04" -> "Apr 2024" */
export function formatPeriod(period: string | null | undefined): string {
  if (!period) return "—";
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return `${MONTHS[month - 1]} ${year}`;
}

/** "2024-25" -> "FY 2024–25" */
export function formatFinancialYear(financialYear: string | null | undefined): string {
  return financialYear ? `FY ${financialYear.replace("-", "–")}` : "—";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") || value.includes(" ") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") || value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

export function initialsOf(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || fallback;
}
