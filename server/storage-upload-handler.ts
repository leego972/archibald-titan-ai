/**
 * Titan Storage — REST Upload/Download Handler
 * Handles multipart file uploads and direct download URL generation.
 * Registered as Express routes alongside the tRPC middleware.
 *
 * Uses busboy for multipart parsing (already in package.json + @types/busboy)
 * instead of multer (not installed), matching the existing voice-router pattern.
 *
 * Admin policy:
 *   - Admins bypass subscription checks entirely.
 *   - Admins can upload files without a storage plan.
 *   - Admins can download any user's file by ID.
 */

import type { Express, Request, Response } from "express";
import { createLogger } from "./_core/logger.js";
import {
  uploadFile,
  getDownloadUrl,
  hasActiveStorageSubscription,
} from "./storage-service";
import { isAdminRole } from "../shared/const";

const log = createLogger("StorageUploadHandler");

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB

// ─── Auth Helper ──────────────────────────────────────────────────────────────

function getUserFromRequest(req: Request): { id: number; role: string } | null {
  const user = (req as any).user;
  if (user?.id) return { id: user.id, role: user.role ?? "" };
  return null;
}

// ─── Register Routes ──────────────────────────────────────────────────────────

export function registerStorageUploadRoutes(app: Express): void {

  /**
   * POST /api/storage/upload
   * Multipart file upload using busboy.
   * - Regular users: require active storage subscription.
   * - Admins: bypass subscription check entirely.
   */
  app.post(
    "/api/storage/upload",
    async (req: Request, res: Response) => {
      try {
        const user = getUserFromRequest(req);
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const isAdmin = isAdminRole(user.role);

        // Non-admins must have an active subscription
        if (!isAdmin) {
          const active = await hasActiveStorageSubscription(user.id, user.role);
          if (!active) {
            return res.status(403).json({
              message: "No active storage subscription. Please purchase a Titan Storage plan.",
            });
          }
        }

        const contentType = req.headers["content-type"] || "";
        if (!contentType.includes("multipart/form-data")) {
          return res.status(400).json({ message: "Expected multipart/form-data" });
        }

        // Parse multipart with busboy (same pattern as voice-router.ts)
        const busboy = await import("busboy");
        const bb = busboy.default({
          headers: req.headers,
          limits: { fileSize: MAX_UPLOAD_SIZE },
        });

        return new Promise<void>((resolve) => {
          let fileBuffer: Buffer | null = null;
          let fileName = "upload";
          let fileMimeType = "application/octet-stream";
          let feature = "generic";
          let featureResourceId: string | undefined;
          let tags: string[] | undefined;

          // Collect field values
          bb.on("field", (name: string, value: string) => {
            if (name === "feature") feature = value;
            if (name === "featureResourceId") featureResourceId = value;
            if (name === "tags") {
              try { tags = JSON.parse(value); } catch { /* ignore */ }
            }
          });

          // Collect file bytes
          bb.on(
            "file",
            (
              _fieldname: string,
              file: NodeJS.ReadableStream,
              info: { filename: string; encoding: string; mimeType: string }
            ) => {
              const chunks: Buffer[] = [];
              fileMimeType = info.mimeType || "application/octet-stream";
              fileName = info.filename || "upload";
              file.on("data", (chunk: Buffer) => chunks.push(chunk));
              file.on("end", () => { fileBuffer = Buffer.concat(chunks); });
            }
          );

          bb.on("finish", async () => {
            if (!fileBuffer) {
              res.status(400).json({ message: "No file provided" });
              return resolve();
            }
            if (fileBuffer.length > MAX_UPLOAD_SIZE) {
              res.status(413).json({ message: "File exceeds 500 MB limit" });
              return resolve();
            }

            try {
              const file = await uploadFile(
                user.id,
                fileBuffer,
                fileName,
                fileMimeType,
                { feature: feature as any, featureResourceId, tags },
                user.role
              );

              log.info(
                `[StorageUpload] ${isAdmin ? "[ADMIN]" : ""} User ${user.id} uploaded ` +
                `${fileName} (${fileBuffer.length} bytes)`
              );

              res.json({
                success: true,
                file: {
                  id: file.id,
                  originalName: file.originalName,
                  mimeType: file.mimeType,
                  sizeBytes: file.sizeBytes,
                  feature: file.feature,
                  createdAt: file.createdAt,
                },
              });
            } catch (err: any) {
              log.error(`[StorageUpload] Upload error: ${err.message}`);
              res.status(400).json({ message: err.message || "Upload failed" });
            }
            resolve();
          });

          bb.on("error", (err: Error) => {
            log.error(`[StorageUpload] Busboy error: ${err.message}`);
            res.status(500).json({ message: "Failed to process upload" });
            resolve();
          });

          req.pipe(bb);
        });

      } catch (err: any) {
        log.error(`[StorageUpload] Unexpected error: ${err.message}`);
        return res.status(500).json({ message: err.message || "Internal error" });
      }
    }
  );

  /**
   * GET /api/storage/download/:fileId
   * Returns a pre-signed download URL for a file.
   * - Regular users: can only download their own files.
   * - Admins: can download any user's file.
   */
  app.get(
    "/api/storage/download/:fileId",
    async (req: Request, res: Response) => {
      try {
        const user = getUserFromRequest(req);
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const fileId = parseInt(req.params.fileId);
        if (isNaN(fileId)) {
          return res.status(400).json({ message: "Invalid file ID" });
        }

        const { url, file } = await getDownloadUrl(user.id, fileId, 3600, user.role);
        return res.json({ url, file_name: file.originalName });
      } catch (err: any) {
        log.error(`[StorageDownload] Error: ${err.message}`);
        return res.status(404).json({ message: err.message || "File not found" });
      }
    }
  );

  /**
   * GET /api/storage/admin/files
   * Admin-only: list all files across the platform with optional filters.
   */
  app.get(
    "/api/storage/admin/files",
    async (req: Request, res: Response) => {
      try {
        const user = getUserFromRequest(req);
        if (!user) return res.status(401).json({ message: "Unauthorized" });
        if (!isAdminRole(user.role)) return res.status(403).json({ message: "Admin access required" });

        const { getDb } = await import("./db");
        const { storageFiles } = await import("../drizzle/storage-schema");
        const { eq, and, desc } = await import("drizzle-orm");

        const db = await getDb();
        if (!db) return res.status(503).json({ message: "Database unavailable" });

        const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
        const offset = parseInt(req.query.offset as string) || 0;

        const conditions: ReturnType<typeof eq>[] = [eq(storageFiles.isDeleted, false)];
        if (userId && !isNaN(userId)) conditions.push(eq(storageFiles.userId, userId));

        const files = await db
          .select()
          .from(storageFiles)
          .where(and(...conditions))
          .orderBy(desc(storageFiles.createdAt))
          .limit(limit)
          .offset(offset);

        return res.json({ files, count: files.length });
      } catch (err: any) {
        log.error(`[StorageAdmin] Error listing files: ${err.message}`);
        return res.status(500).json({ message: err.message || "Internal error" });
      }
    }
  );

  log.info(
    "[StorageUploadHandler] Routes registered: " +
    "POST /api/storage/upload, " +
    "GET /api/storage/download/:fileId, " +
    "GET /api/storage/admin/files"
  );
}
