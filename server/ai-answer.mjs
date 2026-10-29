import { presentAiAnswer } from "./ai-answer-presentation.mjs";
import { buildContext, buildSystemPrompt, askAI } from "./ai-context.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
export const aiLimiter = createRateLimiter({ windowMs: 60000, max: 6, key: req => req.user.id });

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
  const { answer, presentation } = presentAiAnswer(snapshot, selected, question);
  return { question, answer, presentation, from: snapshot.period.from, to: snapshot.period.to, source: snapshot.source, evidence: Object.fromEntries(selected.map(s => [s, snapshot[s]])), data: snapshot.data };
}
export async function askAiHandler(req, res, next) {
  try { res.json(await groundedAnswer(req.user, req.body)); } catch (error) { next(error); }
}
