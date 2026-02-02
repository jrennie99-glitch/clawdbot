/**
 * Simple Production Server for Moltbot Control UI
 * Serves static files + health endpoint + setup wizard
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Global error handlers
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message);
  // Don't exit - keep server running
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", String(reason));
});

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes proxy info
app.get("/api/status", (_req, res) => {
  res.json({
    gateway: "not_started",
    message: "Gateway server not running. Use 'npm run gateway' to start full backend.",
  });
});

// Setup check endpoint
app.get("/api/setup/status", (_req, res) => {
  const setupLocked = process.env.SETUP_LOCKED === "true";
  const configured = !!process.env.LLM_PROVIDER || setupLocked;
  res.json({
    configured,
    locked: setupLocked,
  });
});

// Static files - serve UI build
const uiDistPath = path.join(__dirname, "dist/control-ui");
if (fs.existsSync(uiDistPath)) {
  app.use(express.static(uiDistPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.use((req, res, next) => {
    // Don't intercept API routes
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    // Serve index.html for all other routes (SPA)
    res.sendFile(path.join(uiDistPath, "index.html"));
  });
} else {
  app.use((_req, res) => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Moltbot - Not Built</title></head>
        <body style="font-family:system-ui;padding:2rem;background:#1a1a2e;color:#fff">
          <h1>UI Not Built</h1>
          <p>Run <code>cd ui && npm run build</code> first.</p>
          <p><a href="/health" style="color:#0d6efd">/health</a> is available.</p>
        </body>
      </html>
    `);
  });
}

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] Moltbot UI server listening on http://0.0.0.0:${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
});
