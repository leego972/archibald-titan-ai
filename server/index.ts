import express from "express";
  import { createServer } from "http";
  import path from "path";
  import { fileURLToPath } from "url";
  import { createLogger } from "./_core/logger.js";
  const log = createLogger("Server");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  async function startServer() {
    const app = express();
    const server = createServer(app);

    // Track open connections for graceful drain on shutdown
    const connections = new Set<import("net").Socket>();
    server.on("connection", (socket) => {
      connections.add(socket);
      socket.on("close", () => connections.delete(socket));
    });

    // Serve static files from dist/public in production
    const staticPath =
      process.env.NODE_ENV === "production"
        ? path.resolve(__dirname, "public")
        : path.resolve(__dirname, "..", "dist", "public");

    app.use(express.static(staticPath));

    // Handle client-side routing - serve index.html for all routes
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });

    const port = process.env.PORT || 3000;

    server.listen(port, () => {
      log.info(`Server running on http://localhost:${port}/`);
    });

    // ── Graceful shutdown ────────────────────────────────────────────────────────
    // Railway sends SIGTERM before killing on redeploy/scale — we stop accepting
    // new connections, drain existing ones (max 10 s), then exit cleanly so no
    // in-flight requests are dropped mid-response.
    const shutdown = (signal: string) => {
      log.info(`[Shutdown] ${signal} received — draining ${connections.size} connection(s)...`);
      server.close(() => {
        log.info("[Shutdown] HTTP server closed cleanly. Exiting.");
        process.exit(0);
      });
      // Force-destroy lingering keep-alive sockets so server.close() resolves fast
      for (const socket of connections) socket.destroy();
      // Hard exit if drain stalls beyond 10 s
      setTimeout(() => {
        log.error("[Shutdown] Graceful drain timed out after 10 s — forcing exit.");
        process.exit(1);
      }, 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
  }

  startServer().catch((err) => log.error("Server startup failed", { error: String(err) }));
  