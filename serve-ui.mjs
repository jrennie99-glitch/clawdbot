/**
 * Simple Production Server for Moltbot Control UI
 * Serves static files + health endpoint + setup wizard
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, ".moltbot-config.json");

app.use(express.json());

// Global error handlers
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", String(reason));
});

// Helper functions
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.get("/api/status", (_req, res) => {
  const config = loadConfig();
  res.json({
    gateway: "standalone",
    configured: !!config?.setupLocked,
    llmProvider: config?.llmProvider || "not_configured",
  });
});

// Setup status
app.get("/api/setup/status", (_req, res) => {
  const config = loadConfig();
  res.json({
    configured: !!config?.setupLocked,
    locked: config?.setupLocked ?? false,
  });
});

// Setup wizard - validate token
app.post("/api/setup/validate-token", (req, res) => {
  const config = loadConfig();
  if (config?.setupLocked) {
    return res.status(403).json({ error: "Setup is locked" });
  }

  const { token } = req.body;
  const envToken = process.env.SETUP_TOKEN;

  if (!envToken) {
    return res.status(400).json({ error: "No setup token configured. Run 'npm run setup' first." });
  }

  if (token !== envToken) {
    return res.status(401).json({ error: "Invalid setup token" });
  }

  res.json({ valid: true });
});

// Setup wizard - apply config
app.post("/api/setup/apply", (req, res) => {
  const config = loadConfig();
  if (config?.setupLocked) {
    return res.status(403).json({ error: "Setup is locked" });
  }

  // Validate token
  const { token, ...setupData } = req.body;
  const envToken = process.env.SETUP_TOKEN;
  if (!envToken || token !== envToken) {
    return res.status(401).json({ error: "Invalid setup token" });
  }

  // Validate required fields
  if (!setupData.adminEmail?.includes("@")) {
    return res.status(400).json({ error: "Valid admin email required" });
  }
  if (!setupData.adminPassword || setupData.adminPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const newConfig = {
      adminEmail: setupData.adminEmail,
      adminPasswordHash: hashPassword(setupData.adminPassword),
      hitlMode: setupData.hitlMode || "selective",
      lockdownMode: setupData.lockdownMode ?? true,
      llmProvider: setupData.llmProvider || "auto",
      moonshotApiKey: setupData.moonshotApiKey || undefined,
      openrouterApiKey: setupData.openrouterApiKey || undefined,
      localBaseUrl: setupData.localBaseUrl || "http://localhost:11434/v1",
      allowlistDomains: setupData.allowlistDomains || ["api.moonshot.cn", "openrouter.ai"],
      budgetPerRunUsd: setupData.budgetPerRunUsd ?? 1,
      budgetDailyUsd: setupData.budgetDailyUsd ?? 10,
      budgetMonthlyUsd: setupData.budgetMonthlyUsd ?? 100,
      setupLocked: true,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    console.log("[SETUP] Configuration applied and locked");

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get safe config (no secrets)
app.get("/api/config", (_req, res) => {
  const config = loadConfig();
  if (!config) {
    return res.json({ configured: false });
  }

  res.json({
    configured: true,
    adminEmail: config.adminEmail,
    hitlMode: config.hitlMode,
    lockdownMode: config.lockdownMode,
    llmProvider: config.llmProvider,
    localBaseUrl: config.localBaseUrl,
    allowlistDomains: config.allowlistDomains,
    budgetPerRunUsd: config.budgetPerRunUsd,
    budgetDailyUsd: config.budgetDailyUsd,
    budgetMonthlyUsd: config.budgetMonthlyUsd,
    moonshotConfigured: !!config.moonshotApiKey,
    openrouterConfigured: !!config.openrouterApiKey,
    createdAt: config.createdAt,
  });
});

// Unlock setup (admin only - simplified)
app.post("/api/setup/unlock", (req, res) => {
  const { adminEmail, adminPassword } = req.body;
  const config = loadConfig();

  if (!config) {
    return res.status(400).json({ error: "No config exists" });
  }

  // Verify admin credentials (simplified)
  if (config.adminEmail !== adminEmail) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Unlock
  config.setupLocked = false;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  res.json({ success: true, message: "Setup unlocked" });
});

// Static files - serve UI build
const uiDistPath = path.join(__dirname, "dist/control-ui");
if (fs.existsSync(uiDistPath)) {
  app.use(express.static(uiDistPath));

  // SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
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
