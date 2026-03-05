import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { TRPCError } from "@trpc/server";
import type { Express, Request, Response } from "express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createContext } from "./_core/context";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { createLogger } from "./_core/logger.js";
const log = createLogger("VoiceRouter");

// In-memory store for temporary audio files (id -> { filePath, mimeType, expires })
const tempAudioStore = new Map<string, { filePath: string; mimeType: string; expires: number }>();

// Clean up expired temp files every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of tempAudioStore.entries()) {
    if (entry.expires < now) {
      fs.unlink(entry.filePath, () => {});
      tempAudioStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * Save audio buffer to a temp file and return a local URL for transcription.
 * Files expire after 10 minutes.
 */
async function saveTempAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const id = crypto.randomBytes(16).toString("hex");
  const ext = getExtFromMime(mimeType);
  const filePath = path.join(os.tmpdir(), `titan-voice-${id}.${ext}`);
  await fs.promises.writeFile(filePath, buffer);
  tempAudioStore.set(id, {
    filePath,
    mimeType,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  // Return a server-relative URL that the transcription service can fetch
  return `/api/voice/temp/${id}`;
}

/**
 * Voice transcription tRPC router
 * Handles transcription from an already-uploaded audio URL
 */
export const voiceRouter = router({
  transcribe: protectedProcedure
    .input(
      z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let audioUrl = input.audioUrl;

      // If this is a local temp URL, resolve it to an absolute URL for transcription
      // OR handle it directly by reading the file
      if (audioUrl.startsWith("/api/voice/temp/")) {
        const id = audioUrl.replace("/api/voice/temp/", "");
        const entry = tempAudioStore.get(id);
        if (!entry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Audio file not found or expired" });
        }
        // Transcribe directly from buffer to avoid needing an external URL
        const buffer = await fs.promises.readFile(entry.filePath);
        // Clean up immediately after reading
        fs.unlink(entry.filePath, () => {});
        tempAudioStore.delete(id);

        const result = await transcribeAudioFromBuffer(buffer, entry.mimeType, input.language, input.prompt);
        if ("error" in result) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error,
          });
        }
        return { text: result.text, language: result.language, duration: result.duration };
      }

      // External URL path (S3, etc.)
      const result = await transcribeAudio({
        audioUrl,
        language: input.language,
        prompt: input.prompt || "Transcribe the user's voice command for a chat assistant",
      });

      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
          cause: result,
        });
      }

      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
      };
    }),
});

/**
 * Transcribe audio directly from a buffer (no URL needed)
 */
async function transcribeAudioFromBuffer(
  buffer: Buffer,
  mimeType: string,
  language?: string,
  prompt?: string
): Promise<{ text: string; language: string; duration: number } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    return { error: "Voice transcription not configured — set OPENAI_API_KEY" };
  }

  const ext = getExtFromMime(mimeType);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  formData.append("file", blob, `audio.${ext}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  if (language && language !== "auto") {
    formData.append("language", language);
  }
  formData.append("prompt", prompt || "Transcribe the user's voice command for a chat assistant");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "Accept-Encoding": "identity" },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    return { error: `Transcription failed: ${response.status} ${errText}` };
  }

  const data = await response.json() as { text: string; language: string; duration: number };
  return { text: data.text, language: data.language || "en", duration: data.duration || 0 };
}

/**
 * Express route to serve temporary audio files for transcription
 * GET /api/voice/temp/:id
 */
export function registerVoiceTempRoute(app: Express) {
  app.get("/api/voice/temp/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const entry = tempAudioStore.get(id);
    if (!entry || entry.expires < Date.now()) {
      tempAudioStore.delete(id);
      return res.status(404).json({ error: "Not found or expired" });
    }
    try {
      const buffer = await fs.promises.readFile(entry.filePath);
      res.setHeader("Content-Type", entry.mimeType);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "no-store");
      res.send(buffer);
    } catch {
      res.status(500).json({ error: "Failed to read audio file" });
    }
  });
}

/**
 * Express route for audio file upload
 * POST /api/voice/upload
 * Accepts multipart audio, saves to temp storage, returns local URL
 */
export function registerVoiceUploadRoute(app: Express) {
  app.post("/api/voice/upload", async (req: Request, res: Response) => {
    try {
      // Auth check
      const ctx = await createContext({ req, res, info: {} } as CreateExpressContextOptions);
      if (!ctx.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const MAX_SIZE = 16 * 1024 * 1024; // 16MB
      const contentType = req.headers["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        // Handle multipart form data using busboy
        const busboy = await import("busboy");
        const bb = busboy.default({ headers: req.headers, limits: { fileSize: MAX_SIZE } });

        return new Promise<void>((resolve) => {
          let fileBuffer: Buffer | null = null;
          let fileMimeType = "audio/webm";

          bb.on("file", (_name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
            const fileChunks: Buffer[] = [];
            fileMimeType = info.mimeType || "audio/webm";
            file.on("data", (data: Buffer) => { fileChunks.push(data); });
            file.on("end", () => { fileBuffer = Buffer.concat(fileChunks); });
          });

          bb.on("finish", async () => {
            if (!fileBuffer) {
              res.status(400).json({ error: "No audio file provided" });
              return resolve();
            }
            if (fileBuffer.length > MAX_SIZE) {
              res.status(413).json({ error: "Audio file exceeds 16MB limit" });
              return resolve();
            }
            try {
              const url = await saveTempAudio(fileBuffer, fileMimeType);
              res.json({ url, mimeType: fileMimeType, size: fileBuffer.length });
            } catch (err) {
              log.error("[Voice Upload] Temp save failed:", { error: String(err) });
              res.status(500).json({ error: "Failed to save audio" });
            }
            resolve();
          });

          bb.on("error", (err: Error) => {
            log.error("[Voice Upload] Busboy error:", { error: String(err) });
            res.status(500).json({ error: "Failed to process upload" });
            resolve();
          });

          req.pipe(bb);
        });
      } else {
        // Handle raw binary upload
        const chunks: Buffer[] = [];
        let totalSize = 0;

        req.on("data", (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > MAX_SIZE) {
            res.status(413).json({ error: "Audio file exceeds 16MB limit" });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on("end", async () => {
          if (res.headersSent) return;
          const audioBuffer = Buffer.concat(chunks);
          if (audioBuffer.length === 0) {
            return res.status(400).json({ error: "No audio data received" });
          }
          try {
            const mimeType = contentType.split(";")[0].trim() || "audio/webm";
            const url = await saveTempAudio(audioBuffer, mimeType);
            res.json({ url, mimeType, size: audioBuffer.length });
          } catch (err) {
            log.error("[Voice Upload] Temp save failed:", { error: String(err) });
            res.status(500).json({ error: "Failed to save audio" });
          }
        });
      }
    } catch (err) {
      log.error("[Voice Upload] Error:", { error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
}

/**
 * Express route for text-to-speech
 * POST /api/voice/tts
 * Accepts JSON { text, voice?, speed? }, returns audio/mpeg stream
 */
export function registerVoiceTTSRoute(app: Express) {
  app.post("/api/voice/tts", async (req: Request, res: Response) => {
    try {
      // Auth check
      const ctx = await createContext({ req, res, info: {} } as CreateExpressContextOptions);
      if (!ctx.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { text, voice, speed } = req.body || {};
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "Missing 'text' field" });
      }

      const trimmedText = text.slice(0, 4096);
      const apiKey = process.env.OPENAI_API_KEY || "";
      if (!apiKey) {
        return res.status(503).json({ error: "TTS not configured" });
      }

      const ttsVoice = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(voice) ? voice : "nova";
      const ttsSpeed = typeof speed === "number" && speed >= 0.25 && speed <= 4.0 ? speed : 1.0;

      const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: trimmedText,
          voice: ttsVoice,
          speed: ttsSpeed,
          response_format: "mp3",
        }),
      });

      if (!ttsRes.ok) {
        const errText = await ttsRes.text().catch(() => "");
        log.error("[TTS] OpenAI error:", { status: ttsRes.status, error: errText });
        return res.status(502).json({ error: "TTS generation failed" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache");

      const reader = ttsRes.body?.getReader();
      if (!reader) {
        return res.status(502).json({ error: "No audio stream" });
      }

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      };
      await pump();
    } catch (err) {
      log.error("[TTS] Error:", { error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
  };
  return map[mime] || "webm";
}
