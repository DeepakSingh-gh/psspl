-- Cover the fields used by admin sales/trend aggregates to avoid repeated table reads.
CREATE INDEX IF NOT EXISTS idx_tally_invoices_report_cover
  ON tally_invoices(ingest_session_id, invoice_date, source_sync_id, id, customer_id, voucher_type, amount, customer_name);
CREATE INDEX IF NOT EXISTS idx_tally_invoice_lines_report_cover
  ON tally_invoice_lines(invoice_id, product_name, amount, quantity);
