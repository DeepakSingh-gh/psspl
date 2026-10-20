import { buildContext, buildSystemPrompt, askAI } from "./ai-context.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
export const aiLimiter = createRateLimiter({ windowMs: 60000, max: 6, key: req => req.user.id });

function evidenceText(section, snapshot) {
  const v = snapshot[section], value = n => n == null ? "unavailable" : String(n);
  if (section === "sales") return `Net sales: INR ${value(v.salesValue)}; eligible invoices: ${v.invoiceCount}.`;
  if (section === "topProducts") return v.length ? v.map(p => `${p.name}: INR ${p.salesValue}`).join("; ") : "No eligible product-line evidence available.";
  if (section === "pipeline") return v.length ? v.map(p => `${p.stage}: ${p.count} leads; expected value INR ${p.value} (not confirmed sales)`).join("; ") : "No leads in the authorized scope.";
  if (section === "followUps") return `${v.pending} currently pending; ${v.overdue} overdue; ${v.dueToday} due today. Review the follow-up list and record the next customer action.`;
  if (section === "visits") return `${v.completedInPeriod} completed in period; ${v.upcomingToday} upcoming today; ${v.pastScheduled} past scheduled requiring owner confirmation.`;
  if (section === "performance") return `Actual INR ${value(v.actual)}; target INR ${value(v.target)}; achievement ${value(v.achievementPercent)} percent.`;
  return v.length ? v.map(r => `${r.name}: actual INR ${value(r.performance.actual)}; target INR ${value(r.performance.target)}; achievement ${value(r.performance.achievementPercent)} percent. ${r.attention.map(a => `${a.title}: ${a.metric}. ${a.action}${a.thresholdsProvisional ? " Threshold is provisional." : ""}`).join(" ")}`).join("\n") : "RM comparison is unavailable in this scope.";
}

/** Provider selects evidence; only server-owned facts reach the user. */
export async function groundedAnswer(user, body, provider = askAI) {
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 2000) throw Object.assign(new Error("Enter a question of 1–2000 characters"), { status: 400 });
  const context = await buildContext(user.id, user.role, { from: body.from, to: body.to });
  const snapshot = JSON.parse(context);
  const raw = await provider(buildSystemPrompt(context), question);
  let sections;
  try { sections = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")).sections; } catch {}
  const allowed = ["sales", "topProducts", "pipeline", "followUps", "visits", "performance", "rmPerformance"];
  if (!Array.isArray(sections) || sections.length > 7 || sections.some(s => !allowed.includes(s))) throw Object.assign(new Error("AI returned an unsupported response. Please try a focused question."), { status: 503 });
  const selected = [...new Set(sections)];
  const answer = [`Period: ${snapshot.period.from} to ${snapshot.period.to} (Asia/Kolkata).`, `Source: ${snapshot.source}.`, `Data status: ${snapshot.data.status}; last completed sync: ${snapshot.data.lastCompletedAt ?? "unavailable"}; age in hours: ${snapshot.data.ageHours ?? "unavailable"}.`,
    ...selected.map(s => `**${s}** [evidence: ${s}]\n${evidenceText(s, snapshot)}`),
    ...(selected.length ? [] : ["The authorized context does not support this question. Open the relevant report for detail."]),
    `Limitations: ${snapshot.limitations.join(" ")} Null means unavailable, not zero.`].join("\n\n");
  return { question, answer, from: snapshot.period.from, to: snapshot.period.to, source: snapshot.source, evidence: Object.fromEntries(selected.map(s => [s, snapshot[s]])), data: snapshot.data };
}
export async function askAiHandler(req, res, next) {
  try { res.json(await groundedAnswer(req.user, req.body)); } catch (error) { next(error); }
}
