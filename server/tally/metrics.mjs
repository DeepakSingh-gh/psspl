/** Shared SQL rules for authoritative Tally invoice calculations. */
export function authoritativeInvoiceWhere(alias = "i") {
  return `${alias}.ingest_session_id IS NULL AND (${alias}.source_sync_id IS NULL OR ${alias}.source_sync_id <> 'excel-import')`;
}

/**
 * Tally connector parsing stores voucher magnitudes as positive values. Apply
 * credit notes and explicit sales-return vouchers as reductions at report time.
 * Cancellation state is not represented in the current schema and is therefore
 * not guessed here.
 */
export function netInvoiceAmount(alias = "i") {
  return `CASE WHEN lower(${alias}.voucher_type) LIKE '%credit note%' OR lower(${alias}.voucher_type) LIKE '%sales return%' THEN -ABS(${alias}.amount) ELSE ${alias}.amount END`;
}

export function netInvoiceLineAmount(invoiceAlias = "i", lineAlias = "l") {
  return `CASE WHEN lower(${invoiceAlias}.voucher_type) LIKE '%credit note%' OR lower(${invoiceAlias}.voucher_type) LIKE '%sales return%' THEN -ABS(${lineAlias}.amount) ELSE ${lineAlias}.amount END`;
}

export function financialYearForDate(date) {
  const match = /^(\d{4})-(\d{2})/.exec(String(date ?? ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function rupeesToLakh(value) {
  return Number((Number(value || 0) / 100_000).toFixed(2));
}

export function rupeesToCrore(value) {
  return Number((Number(value || 0) / 10_000_000).toFixed(2));
}
