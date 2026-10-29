import test from "node:test";
import assert from "node:assert/strict";
import { askAI } from "../server/ai-provider.mjs";

test("Ask AI provider configuration and failure handling", async (t) => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  t.after(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });
  process.env.NODE_ENV = "production";
  for (const key of ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "Claude api key", "CRM_AI_PROVIDER"]) delete process.env[key];
  delete process.env.GEMINI_API_KEY;
  delete process.env["gemini api key"];
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_MODEL;

  await t.test("missing keys reject without making a request", async () => {
    globalThis.fetch = () => { throw new Error("Unexpected request"); };
    await assert.rejects(askAI("context", "question"), { status: 503, message: /backend hosting environment/ });
    process.env.OPENAI_API_KEY = "sk-...";
    await assert.rejects(askAI("context", "question"), { status: 503 });
    delete process.env.OPENAI_API_KEY;
  });

  await t.test("Gemini uses a header key and combines response parts", async () => {
    process.env.GEMINI_API_KEY = ' "test-key" ';
    globalThis.fetch = async (url, init) => {
      assert.match(url, /models\/gemini-2.5-flash:generateContent$/);
      assert.ok(!url.includes("test-key"));
      assert.equal(init.headers["x-goog-api-key"], "test-key");
      return Response.json({ candidates: [{ content: { parts: [{ text: "Hidden", thought: true }, { text: "Answer" }, {text: "Details"}] } }] });
    };
    assert.equal(await askAI("context", "question"), "Answer\nDetails");
  });

  await t.test("unavailable custom model falls back to the default", async () => {
    process.env.GEMINI_MODEL = "custom-model";
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return urls.length === 1 ? new Response("", {status: 404}) : Response.json({ candidates: [{content: {parts: [{text: "Fallback"}]}}] });
    };
    assert.equal(await askAI("context", "question"), "Fallback");
    assert.equal(urls.length, 2);
    delete process.env.GEMINI_MODEL;
  });

  await t.test("Gemini failure falls back to OpenAI", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    globalThis.fetch = async (url) => url.includes("googleapis")
      ? new Response("", { status: 403 })
      : Response.json({ choices: [{ message: { content: "OpenAI answer" } }] });
    assert.equal(await askAI("context", "question"), "OpenAI answer");
  });

  await t.test("provider failures are errors, never successful AI answers", async () => {
    globalThis.fetch = async () => new Response("", { status: 429 });
    await assert.rejects(askAI("context", "question"), { status: 503 });
  });

  await t.test("provider timeout aborts the request and returns unavailable", async () => {
    delete process.env.GEMINI_API_KEY;
    const originalTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, _ms) => originalTimeout(callback, 1);
    try {
      globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("synthetic timeout"), { name: "AbortError" })), { once: true });
      });
      await assert.rejects(askAI("context", "question"), { status: 503 });
    } finally { globalThis.setTimeout = originalTimeout; }
  });
});
