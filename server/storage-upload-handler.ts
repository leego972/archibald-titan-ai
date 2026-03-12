/**
 * Titan Storage — REST Upload/Download Handler
 * Handles multipart file uploads and direct download URL generation.
 * Registered as Express routes alongside the tRPC middleware.
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { createLogger } from "./_core/logger.js";
import {
  uploadFile,
  getDownloadUrl,
  hasActiveStorageSubscription,
} from "./storage-service";

const log = createLogger("StorageUploadHandler");

// ─── Multer (memory storage, 500 MB limit) ────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max per file
});

// ─── Session/JWT Auth Helper ──────────────────────────────────────

function getUserIdFromRequest(req: Request): number | null {
  // The existing Titan session middleware attaches the user to req.user
  const user = (req as any).user;
  if (user?.id) return user.id;
  return null;
}

// ─── Register Routes ──────────────────────────────────────────────

export function registerStorageUploadRoutes(app: Express): void {

  /**
   * POST /api/storage/upload
   * Multipart file upload. Requires active storage subscription.
   */
  app.post(
    "/api/storage/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const active = await hasActiveStorageSubscription(userId);
        if (!active) {
          return res.status(403).json({
            message: "No active storage subscription. Please purchase a Titan Storage plan.",
          });
        }

        if (!req.file) {
          return res.status(400).json({ message: "No file provided" });
        }

        const feature = (req.body.feature as string) || "generic";
        const featureResourceId = req.body.featureResourceId as string | undefined;
        const tags = req.body.tags ? JSON.parse(req.body.tags) : undefined;

        const file = await uploadFile(
          userId,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          { feature: feature as any, featureResourceId, tags }
        );

        log.info(`[StorageUpload] User ${userId} uploaded ${req.file.originalname} (${req.file.size} bytes)`);

        return res.json({
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
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
    }
  );

  /**
   * GET /api/storage/download/:fileId
   * Returns a pre-signed download URL for a file.
   */
  app.get(
    "/api/storage/download/:fileId",
    async (req: Request, res: Response) => {
      try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const fileId = parseInt(req.params.fileId);
        if (isNaN(fileId)) {
          return res.status(400).json({ message: "Invalid file ID" });
        }

        const { url, file } = await getDownloadUrl(userId, fileId);
        return res.json({ url, file_name: file.originalName });
      } catch (err: any) {
        log.error(`[StorageDownload] Error: ${err.message}`);
        return res.status(404).json({ message: err.message || "File not found" });
      }
    }
  );

  log.info("[StorageUploadHandler] Routes registered: POST /api/storage/upload, GET /api/storage/download/:fileId");
}
