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

/** Display dates as DD-MM-YYYY; timestamps use the India business timezone. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("-");
  const date = new Date(value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replaceAll("/", "-");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(value)}, ${date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;
}

export function initialsOf(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || fallback;
}
