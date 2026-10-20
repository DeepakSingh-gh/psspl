import fs from "node:fs";
import path from "node:path";

function cleanKey(value) {
  const key = String(value ?? "").trim().replace(/^["']|["']$/g, "");
  if (!key || /^(sk-\.\.\.|your[_ -]|change[-_]|<)/i.test(key)) return null;
  return key;
}

function getGeminiKey() {
  const configured = cleanKey(process.env.GEMINI_API_KEY) || cleanKey(process.env["gemini api key"]);
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return null;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("GEMINI_API_KEY=") || trimmed.toLowerCase().startsWith("gemini api key=")) {
          const parts = trimmed.split("=");
          if (parts.length >= 2) return cleanKey(parts.slice(1).join("="));
        }
      }
    }
  } catch {}
  return null;
}

export async function askAI(systemPrompt, userQuestion) {
  const geminiKey = getGeminiKey();
  const openAiKey = cleanKey(process.env.OPENAI_API_KEY);

  if (geminiKey) {
    const models = [...new Set([process.env.GEMINI_MODEL?.trim(), "gemini-2.5-flash"].filter(Boolean))];
    for (const model of models) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUSER QUESTION: ${userQuestion}` }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 800,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        });

        if (resp.ok) {
          const json = await resp.json();
          const parts = json.candidates?.[0]?.content?.parts ?? [];
          const answer = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n").trim();
          if (answer) return answer;
        } else {
          console.warn(`[AI] Gemini ${model} returned ${resp.status}`);
        }
      } catch (e) {
        if (e.name === "AbortError") {
          console.warn(`[AI] Gemini ${model} timed out`);
        } else {
          console.error(`[AI] Gemini ${model} request failed`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  if (openAiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userQuestion }],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        const answer = json.choices?.[0]?.message?.content;
        if (answer?.trim()) return answer;
      } else {
        console.warn(`[AI] OpenAI returned ${resp.status}`);
      }
    } catch (e) {
      console.error("[AI] OpenAI request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  if (geminiKey || openAiKey) {
    throw Object.assign(new Error("Ask AI could not reach its AI provider. Please try again; if this continues, ask your administrator to check the backend API key, model and quota."), { status: 503 });
  }

  throw Object.assign(new Error("Ask AI is not configured on the backend server. An administrator must set GEMINI_API_KEY or OPENAI_API_KEY in the backend hosting environment and redeploy the service."), { status: 503 });
}

export const askOpenAI = askAI;
