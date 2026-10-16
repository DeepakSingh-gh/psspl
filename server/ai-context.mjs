import { db } from "./db.mjs";

/**
 * Builds a compact JSON context string (<2000 chars) for the OpenAI system prompt.
 * scope: "admin" = company-wide, "rm" = team-scoped, "salesperson" = individual
 */
export async function buildContext(userId, scope) {
  const today = new Date().toISOString().slice(0, 10);
  const fyStart = (() => { const now = new Date(); const y = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1; return `${y}-04-01`; })();

  let userIds = [userId];
  if (scope === "rm") {
    const reports = db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(userId).map((r) => r.user_id);
    userIds = [userId, ...reports];
  } else if (scope === "admin") {
    userIds = db.prepare("SELECT id FROM users WHERE active=1 AND role IN ('salesperson','rm')").all().map((u) => u.id);
  }

  const ph = userIds.map(() => "?").join(",");

  // Top 5 products by sales value
  const topProducts = db.prepare(`
    SELECT p.name, COALESCE(SUM(l.amount),0) salesValue
    FROM tally_products p
    LEFT JOIN tally_invoice_lines l ON l.product_id=p.id
    LEFT JOIN tally_invoices i ON i.id=l.invoice_id AND i.invoice_date BETWEEN ? AND ?
    GROUP BY p.id ORDER BY salesValue DESC LIMIT 5
  `).all(fyStart, today);

  // Overdue follow-ups count
  const overdueFollowUps = userIds.length
    ? db.prepare(`SELECT COUNT(*) count FROM follow_ups WHERE user_id IN (${ph}) AND completed=0 AND due_date<?`).get(...userIds, today)
    : { count: 0 };

  // Pipeline totals by stage
  const pipeline = userIds.length
    ? db.prepare(`SELECT stage, COUNT(*) count, COALESCE(SUM(expected_value),0) value FROM leads WHERE user_id IN (${ph}) GROUP BY stage`).all(...userIds)
    : [];

  // Stagnant leads: generated but not converted (>30 days open)
  const stagnantLeadsCount = userIds.length
    ? db.prepare(`SELECT COUNT(*) count FROM leads WHERE user_id IN (${ph}) AND stage NOT IN ('won', 'lost') AND created_at < date('now', '-30 days')`).get(...userIds).count
    : 0;

  // Thrust products: designated top products for the year (derived from previous year's best sellers)
  const prevFyStart = (() => { const y = new Date(fyStart).getFullYear() - 1; return `${y}-04-01`; })();
  const thrustProducts = db.prepare(`
    SELECT p.name, COALESCE(SUM(l.amount),0) salesValue
    FROM tally_products p
    LEFT JOIN tally_invoice_lines l ON l.product_id=p.id
    LEFT JOIN tally_invoices i ON i.id=l.invoice_id AND i.invoice_date BETWEEN ? AND ?
    GROUP BY p.id ORDER BY salesValue DESC LIMIT 3
  `).all(prevFyStart, fyStart);

  // Inactive customers (no invoice in last 90 days), admin only
  let inactiveCount = 0;
  if (scope === "admin") {
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    inactiveCount = db.prepare(`SELECT COUNT(*) count FROM tally_customers WHERE id NOT IN (SELECT DISTINCT customer_id FROM tally_invoices WHERE invoice_date>=? AND customer_id IS NOT NULL)`).get(cutoff).count;
  }

  // Team performance vs target (salesperson scope)
  let performanceSummary = "";
  if (scope === "salesperson") {
    const profile = db.prepare("SELECT full_name, monthly_target, region FROM salesperson_profiles WHERE user_id=?").get(userId);
    const sales = db.prepare("SELECT COALESCE(SUM(i.amount),0) total FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE c.owner_user_id=? AND i.invoice_date BETWEEN ? AND ?").get(userId, fyStart, today);
    performanceSummary = `Salesperson: ${profile?.full_name}, Region: ${profile?.region}, Monthly target: ₹${profile?.monthly_target ?? 0}Cr, YTD sales: ₹${((sales?.total ?? 0) / 100000).toFixed(2)}L`;
  }

  const ctx = {
    scope,
    date: today,
    financialYearFrom: fyStart,
    thrustProducts: thrustProducts.map((p) => p.name),
    topProducts: topProducts.map((p) => ({ name: p.name, salesValue: `₹${(p.salesValue / 100000).toFixed(2)}L` })),
    overdueFollowUps: overdueFollowUps.count,
    stagnantLeads: stagnantLeadsCount,
    pipeline: pipeline.map((p) => ({ stage: p.stage, count: p.count, value: `₹${(p.value / 100000).toFixed(2)}L` })),
    ...(inactiveCount > 0 ? { inactiveCustomers: inactiveCount } : {}),
    ...(performanceSummary ? { performance: performanceSummary } : {}),
  };

  return JSON.stringify(ctx, null, 2).slice(0, 2000);
}

export function buildSystemPrompt(contextJson) {
  return `You are an AI executive business analyst for Progressive Surface Systems (PSSPL), a specialty surface coatings company.
Answer management & sales questions using ONLY the live company database metrics provided below.
Be concise, data-driven, and highly professional. Cite exact figures.

CRITICAL INSTRUCTIONS:
- If there are 'stagnantLeads' (>0), firmly flag them as leads that are generated but failing to convert into clients.
- The 'thrustProducts' are the designated focus products for the year (most historically sold). If any thrust product is not performing well or missing from the current topProducts, you MUST flag this and provide a brief analytical reason why it might not be selling.
- Format suggestions as clean numbered points (e.g. 1., 2., 3.).
- For each numbered point, use clear bold headers like:
  1. **[Clear Recommendation Title]**
  **Data Point:** [Exact numerical metric/count from live DB]
  **Action:** [Actionable business strategy]
- Avoid raw code syntax (such as '[]') and do NOT include double asterisk asterisks like '* * **Data Point:**'.
- If a metric is empty or zero, state it gracefully.

CURRENT LIVE PSSPL DATABASE METRICS:
${contextJson}`;
}

export { askAI, askOpenAI } from "./ai-provider.mjs";
