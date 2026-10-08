import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const sttRouter = Router();

function getOpenAIKey() {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-")) {
    return process.env.OPENAI_API_KEY.trim();
  }
  if (process.env["OpenAI api key"] && process.env["OpenAI api key"].startsWith("sk-")) {
    return process.env["OpenAI api key"].trim();
  }
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("OPENAI_API_KEY=") || trimmed.toLowerCase().startsWith("openai api key=")) {
          const parts = trimmed.split("=");
          if (parts.length >= 2) {
            const val = parts.slice(1).join("=").trim();
            if (val.startsWith("sk-")) return val;
          }
        }
      }
    }
  } catch {}
  return null;
}

sttRouter.post("/stt", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }

    const openAiKey = getOpenAIKey();
    if (!openAiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured in .env file." });
    }

    const formData = new FormData();
    const file = new File([req.file.buffer], req.file.originalname || "speech.webm", { type: req.file.mimetype || "audio/webm" });
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsed = {};
      try { parsed = JSON.parse(errText); } catch {}
      const errorMsg = parsed?.error?.message || "OpenAI Speech API error.";
      console.error("[STT] OpenAI Whisper API error:", response.status, errText);
      return res.status(response.status).json({ error: errorMsg, details: parsed });
    }

    const data = await response.json();
    return res.json({ text: data.text || "" });
  } catch (error) {
    console.error("[STT] Exception during transcription:", error);
    return res.status(500).json({ error: "Server error during speech transcription." });
  }
});
