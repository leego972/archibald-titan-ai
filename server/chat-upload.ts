import { Express, Request, Response } from "express";
import { createContext } from "./_core/context";
import { storagePut } from "./storage";
import crypto from "crypto";
import { createLogger } from "./_core/logger.js";
import { scanFileForMalware, trackIncident } from "./security-fortress";
const log = createLogger("ChatUpload");

/**
 * Check if external storage (S3 or Forge) is configured.
 */
function hasExternalStorage(): boolean {
  return !!(
    process.env.AWS_S3_BUCKET ||
    (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY)
  );
}

/**
 * Store file in the database as a fallback when S3 is not configured.
 * Uses the chat_uploads table with mediumblob storage.
 */
async function storeInDatabase(
  userId: number,
  fileKey: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<string> {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Use raw SQL to insert the blob
  const { sql } = await import("drizzle-orm");
  await db.execute(
    sql.raw(
      `INSERT INTO chat_uploads (userId, fileKey, fileName, mimeType, fileSize, data) VALUES (${userId}, '${fileKey}', '${fileName.replace(/'/g, "''")}', '${mimeType}', ${fileBuffer.length}, x'${fileBuffer.toString("hex")}')`
    )
  );

  // Return a URL that points to our serve endpoint
  const baseUrl =
    process.env.PUBLIC_URL ||
    `https://${process.env.RAILWAY_PUBLIC_DOMAIN || "www.archibaldtitan.com"}`;
  return `${baseUrl}/api/chat/uploads/${encodeURIComponent(fileKey)}`;
}

/**
 * Express route for chat file upload
 * POST /api/chat/upload
 * Accepts multipart files, uploads to S3 or falls back to database storage
 */
export function registerChatUploadRoute(app: Express) {
  // ── Serve endpoint for database-stored uploads ──────────────────
  app.get("/api/chat/uploads/*", async (req: Request, res: Response) => {
    try {
      const fileKey = req.params[0]; // everything after /api/chat/uploads/
      if (!fileKey) {
        return res.status(400).json({ error: "File key required" });
      }

      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database unavailable" });
      }

      const result = await db.execute(
        sql.raw(
          `SELECT mimeType, data, fileName FROM chat_uploads WHERE fileKey = '${fileKey.replace(/'/g, "''")}' LIMIT 1`
        )
      );

      const rows = result[0] as any[];
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      const row = rows[0];
      const mimeType = row.mimeType || "application/octet-stream";
      const data = row.data as Buffer;
      const fileName = row.fileName || "file";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", data.length);
      // Allow images to be displayed inline
      if (mimeType.startsWith("image/")) {
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
      } else {
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      }
      // Allow cross-origin access for the chat to display images
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(data);
    } catch (err) {
      log.error("[Chat Upload] Serve error:", { error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to serve file" });
      }
    }
  });

  // ── Upload endpoint ─────────────────────────────────────────────
  app.post("/api/chat/upload", async (req: Request, res: Response) => {
    try {
      // Auth check
      const ctx = await createContext({ req, res, info: {} as any });
      if (!ctx.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Handle multipart form data using busboy
      const busboy = await import("busboy");
      const bb = busboy.default({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

      const fileChunks: Buffer[] = [];
      let fileMimeType = "application/octet-stream";
      let originalFileName = "file";

      bb.on("file", (_name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        fileMimeType = info.mimeType || "application/octet-stream";
        originalFileName = info.filename || "file";
        file.on("data", (data: Buffer) => fileChunks.push(data));
      });

      bb.on("finish", async () => {
        const fileBuffer = Buffer.concat(fileChunks);
        if (fileBuffer.length === 0) {
          return res.status(400).json({ error: "No file provided" });
        }

        // ── SECURITY: Malware scan on text-based uploads ─────────
        const textMimes = ["text/", "application/javascript", "application/json", "application/typescript"];
        if (textMimes.some(m => fileMimeType.startsWith(m))) {
          const content = fileBuffer.toString("utf-8");
          const scan = await scanFileForMalware(content, `chat-upload-${Date.now()}`, ctx.user!.id);
          if (!scan.safe) {
            log.error(`[Chat Upload] Malware detected (risk: ${scan.riskScore}/100)`);
            await trackIncident(ctx.user!.id, "malware_upload");
            return res.status(403).json({
              error: "File rejected: suspicious code patterns detected.",
              riskScore: scan.riskScore,
            });
          }
        }

        try {
          const randomSuffix = crypto.randomBytes(8).toString("hex");
          const fileKey = `chat/${ctx.user!.id}/${Date.now()}-${randomSuffix}`;

          let url: string;

          if (hasExternalStorage()) {
            // Use S3 or Forge storage
            const result = await storagePut(fileKey, fileBuffer, fileMimeType, originalFileName);
            url = result.url;
          } else {
            // Fall back to database storage
            log.info("[Chat Upload] No external storage configured, using database fallback");
            url = await storeInDatabase(ctx.user!.id, fileKey, originalFileName, fileMimeType, fileBuffer);
          }

          res.json({ url, mimeType: fileMimeType, size: fileBuffer.length });
        } catch (err) {
          log.error("[Chat Upload] Upload failed:", { error: String(err) });
          res.status(500).json({ error: "Failed to upload file" });
        }
      });

      bb.on("error", (err: Error) => {
        log.error("[Chat Upload] Busboy error:", { error: String(err) });
        if (!res.headersSent) {
          res.status(500).json({ error: "Upload processing failed" });
        }
      });

      req.pipe(bb);
    } catch (err) {
      log.error("[Chat Upload] Error:", { error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });
}
