/**
 * Titan Storage — REST Upload/Download Handler
 * Handles multipart file uploads and direct download URL generation.
 * Registered as Express routes alongside the tRPC middleware.
 *
 * Admin policy:
 *   - Admins bypass subscription checks entirely.
 *   - Admins can upload files without a storage plan.
 *   - Admins can download any user's file by ID.
 *   - Admin role is read from req.user.role (set by existing session middleware).
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { createLogger } from "./_core/logger.js";
import {
  uploadFile,
  getDownloadUrl,
  hasActiveStorageSubscription,
} from "./storage-service";
import { isAdminRole } from "../shared/const";

const log = createLogger("StorageUploadHandler");

// ─── Multer (memory storage, 500 MB limit) ────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max per file
});

// ─── Auth Helper ──────────────────────────────────────────────────────────────

function getUserFromRequest(req: Request): { id: number; role: string } | null {
  // The existing Titan session middleware attaches the user to req.user
  const user = (req as any).user;
  if (user?.id) return { id: user.id, role: user.role ?? "" };
  return null;
}

// ─── Register Routes ──────────────────────────────────────────────────────────

export function registerStorageUploadRoutes(app: Express): void {

  /**
   * POST /api/storage/upload
   * Multipart file upload.
   * - Regular users: require active storage subscription.
   * - Admins: bypass subscription check entirely.
   */
  app.post(
    "/api/storage/upload",
    upload.single("file"),
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

        if (!req.file) {
          return res.status(400).json({ message: "No file provided" });
        }

        const feature = (req.body.feature as string) || "generic";
        const featureResourceId = req.body.featureResourceId as string | undefined;
        const tags = req.body.tags ? JSON.parse(req.body.tags) : undefined;

        const file = await uploadFile(
          user.id,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          { feature: feature as any, featureResourceId, tags },
          user.role
        );

        log.info(
          `[StorageUpload] ${isAdmin ? "[ADMIN]" : ""} User ${user.id} uploaded ` +
          `${req.file.originalname} (${req.file.size} bytes)`
        );

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

        const conditions: any[] = [eq(storageFiles.isDeleted, false)];
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
