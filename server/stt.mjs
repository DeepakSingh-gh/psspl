import { Router } from "express";
import multer from "multer";
import { authenticate } from "./auth.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
import { usesClaude } from "./ai-provider.mjs";

const allowedAudioTypes = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4", "audio/aac"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 2 },
  fileFilter: (_req, file, callback) => callback(null, allowedAudioTypes.has(file.mimetype)),
});

export const sttRouter = Router();

function getOpenAIKey() {
  return [process.env.OPENAI_API_KEY, process.env["OpenAI api key"]]
    .find((value) => typeof value === "string" && value.trim().startsWith("sk-"))?.trim() || null;
}

const transcriptionLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12, key: (req) => req.user?.id || req.ip });

sttRouter.post("/stt", authenticate, transcriptionLimiter, upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }

    if (usesClaude()) return res.status(503).json({ error: "Claude API does not provide this audio transcription endpoint. Use browser voice dictation or type the text." });

    const openAiKey = getOpenAIKey();
    if (!openAiKey) {
      return res.status(503).json({ error: "Speech transcription is not configured." });
    }

    const formData = new FormData();
    const file = new File([req.file.buffer], "speech.webm", { type: req.file.mimetype });
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAiKey}` },
        body: formData,
        signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      console.error("[STT] Provider rejected transcription with status", response.status);
      return res.status(502).json({ error: "Speech transcription provider failed." });
    }

    const data = await response.json();
    return res.json({ text: data.text || "" });
  } catch (error) {
    console.error("[STT] Transcription request failed:", error.name === "AbortError" ? "provider timeout" : error.message);
    return res.status(error.name === "AbortError" ? 504 : 502).json({ error: "Speech transcription failed." });
  }
});
