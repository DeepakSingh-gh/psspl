import { attendanceMonths } from '../shared/rm-attendance.mjs';
import { authoritativeInvoiceWhere, netInvoiceAmount } from './tally/metrics.mjs';

export function reportAttendance(db, { user, name, code, financialYear, cutoff, today }) {
  const start = `${financialYear.slice(0,4)}-04-01`;
  const rows = user ? db.prepare('SELECT id,business_date,check_in_at,check_out_at FROM attendance WHERE user_id=? AND business_date BETWEEN ? AND ? ORDER BY business_date,id').all(user.id, start, cutoff) : [];
  return { available: Boolean(user), cutoff, subject: { name, code, role: user?.role ?? 'rm' },
    months: attendanceMonths({ financialYear, cutoff, today, rows, available: Boolean(user) }),
    note: user ? 'Sunday off. Missing check-ins are unverified: employment dates and an approved absence policy are not recorded. Attendance % is unavailable.' : 'No unique CRM account is mapped; attendance is unavailable.' };
}

export function reportThrustYtd(db, { ids, from, to, available, thrust, discloseCompanyTotal = false }) {
  const company = from <= to ? db.prepare(`SELECT COUNT(*) count,COUNT(DISTINCT NULLIF(trim(i.company_name),'')) companies,SUM(CASE WHEN NULLIF(trim(i.company_name),'') IS NULL THEN 1 ELSE 0 END) unmapped,SUM(CASE WHEN typeof(i.amount) NOT IN ('real','integer') THEN 1 ELSE 0 END) invalidAmounts,SUM(${netInvoiceAmount('i')}) value FROM tally_invoices i WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ?`).get(from,to) : null;
  const singleCompany = company?.companies === 1 && company.unmapped === 0;
  const slots = ids.map(() => '?').join(',') || "''";
  const evidence = from <= to && available ? db.prepare(`SELECT COUNT(*) count,SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM tally_invoice_lines l WHERE l.invoice_id=i.id) OR typeof(i.amount) NOT IN ('real','integer') OR EXISTS(SELECT 1 FROM tally_invoice_lines l WHERE l.invoice_id=i.id AND typeof(l.amount) NOT IN ('real','integer')) THEN 1 ELSE 0 END) incompleteInvoices FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere('i')} AND c.owner_user_id IN (${slots}) AND i.invoice_date BETWEEN ? AND ?`).get(...ids,from,to) : null;
  const complete = singleCompany && evidence?.count > 0 && evidence.incompleteInvoices === 0;
  const denominator = singleCompany && company.count > 0 && company.invalidAmounts === 0 ? company.value : null;
  const configured = thrust(from,to).products;
  return { from, to, companyNetSales: discloseCompanyTotal ? denominator : null,
    products: configured.map(p => { const sales = complete ? p.salesRupees : null; return { id:p.id, name:p.name, sales, companyContributionPercent: sales != null && denominator > 0 ? sales / denominator * 100 : null }; }),
    note: !singleCompany ? 'A unique company-wide invoice scope is unavailable; product sales and contribution are N/A.' : !complete ? 'Verified owner-attributed invoice lines are unavailable or incomplete; product sales and contribution are N/A.' : denominator == null ? 'Company-wide invoice amounts are incomplete; contribution is N/A.' : denominator <= 0 ? 'Company-wide YTD net sales is not positive; contribution is N/A.' : 'Recorded net invoices, current customer ownership. Categories may overlap; do not add them together.',
  };
}
