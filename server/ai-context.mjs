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
    topProducts: topProducts.map((p) => ({ name: p.name, salesValue: `₹${(p.salesValue / 100000).toFixed(2)}L` })),
    overdueFollowUps: overdueFollowUps.count,
    pipeline: pipeline.map((p) => ({ stage: p.stage, count: p.count, value: `₹${(p.value / 100000).toFixed(2)}L` })),
    ...(inactiveCount > 0 ? { inactiveCustomers: inactiveCount } : {}),
    ...(performanceSummary ? { performance: performanceSummary } : {}),
  };

  return JSON.stringify(ctx, null, 2).slice(0, 2000);
}

export function buildSystemPrompt(contextJson) {
  return `You are an AI business analyst for Progressive Surface Systems (PSSPL), a specialty surface coatings company.
Answer questions about PSSPL's sales, team performance, products and customers using ONLY the data provided below.
Be concise and specific. Cite exact numbers from the data. If asked to draft an email, use clear Markdown formatting.
If the data does not contain the answer, clearly say so instead of guessing.

Supported question types:
1. Which RM or territory needs attention and why?
2. Which products sold less than last month/year?
3. Which customers reduced repeat orders?
4. What is the likely year-end shortfall?
5. Which territory needs support for which product?
6. Draft a management email about a performance gap.

CURRENT PSSPL DATA:
${contextJson}`;
}

export async function askOpenAI(systemPrompt, userQuestion) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "Ask AI is not configured. Please add OPENAI_API_KEY to the server .env file to enable AI-powered analysis.";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userQuestion }],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "unknown error");
      console.error("[AI] OpenAI error:", errText);
      return "Ask AI is temporarily unavailable. Please try again shortly.";
    }
    const json = await resp.json();
    return json.choices?.[0]?.message?.content ?? "No response received from AI.";
  } catch (e) {
    if (e.name === "AbortError") return "Ask AI timed out after 30 seconds. Please try a simpler question.";
    console.error("[AI] Error:", e);
    return "Ask AI is temporarily unavailable.";
  } finally {
    clearTimeout(timeout);
  }
}
