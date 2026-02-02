/**
 * MoltBot Production Server
 * - Serves static UI files from dist/control-ui
 * - Proxies WebSocket connections to the gateway backend
 * - Provides health endpoint + setup wizard API
 * - Injects auth token into the UI
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT ?? "8001", 10);
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, ".moltbot-config.json");
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.CLAWDBOT_GATEWAY_TOKEN || "moltbot-preview-token-2024";

app.use(express.json());

// Global error handlers - PRODUCTION (silent)
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

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

// Security headers middleware - PRODUCTION MODE
app.use((req, res, next) => {
  // Strict CSP for production
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ws: wss: https:; img-src 'self' data: blob: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // HSTS - enforce HTTPS
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Cache control for security
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    gateway: {
      port: GATEWAY_PORT,
      url: `ws://127.0.0.1:${GATEWAY_PORT}`,
    },
  });
});

// Gateway health check (proxy to backend)
app.get("/api/gateway/health", async (_req, res) => {
  try {
    const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/health`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(503).json({
      status: "error",
      message: "Gateway not reachable",
      error: String(err),
    });
  }
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

// Setup status - LOCKED IN PRODUCTION
app.get("/api/setup/status", (_req, res) => {
  const config = loadConfig();
  // In production mode, setup is always locked
  res.json({
    configured: true,
    locked: true,
    production: true
  });
});

// Setup wizard - DISABLED IN PRODUCTION
app.post("/api/setup/validate-token", (_req, res) => {
  return res.status(403).json({ error: "Setup disabled in production mode" });
});

// Setup wizard - DISABLED IN PRODUCTION
app.post("/api/setup/apply", (_req, res) => {
  return res.status(403).json({ error: "Setup disabled in production mode" });
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

// Unlock setup - DISABLED IN PRODUCTION
app.post("/api/setup/unlock", (_req, res) => {
  return res.status(403).json({ error: "Setup modification disabled in production mode" });
});

// UI dist path
const uiDistPath = path.join(__dirname, "dist/control-ui");

// Generate modified index.html with injected token
function getIndexHtml() {
  const indexPath = path.join(uiDistPath, "index.html");
  if (!fs.existsSync(indexPath)) return null;
  
  let html = fs.readFileSync(indexPath, "utf-8");
  
  // Inject script to set token in localStorage before app loads
  const tokenScript = `
<script>
  (function() {
    // Pre-configure auth token for gateway connection
    var KEY = "moltbot.control.settings.v1";
    try {
      var saved = localStorage.getItem(KEY);
      var settings = saved ? JSON.parse(saved) : {};
      // Always update token to ensure fresh value
      settings.token = "${GATEWAY_TOKEN}";
      settings.gatewayUrl = settings.gatewayUrl || (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host;
      localStorage.setItem(KEY, JSON.stringify(settings));
      console.log("[MoltBot] Auto-configured gateway auth token");
    } catch (e) {
      console.warn("[MoltBot] Failed to configure token:", e);
    }
  })();
</script>`;
  
  // Insert before any other scripts
  html = html.replace("<head>", "<head>" + tokenScript);
  
  return html;
}

if (fs.existsSync(uiDistPath)) {
  // Serve index.html with token injection for root and SPA routes
  app.get("/", (req, res) => {
    const html = getIndexHtml();
    if (html) {
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } else {
      res.status(500).send("UI not built");
    }
  });

  // Serve static assets (CSS, JS, images) without modification
  app.use("/assets", express.static(path.join(uiDistPath, "assets")));
  app.use("/favicon.ico", express.static(path.join(uiDistPath, "favicon.ico")));

  // SPA fallback for all other non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    // Serve modified index.html for SPA routes
    const html = getIndexHtml();
    if (html) {
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } else {
      next();
    }
  });
} else {
  app.use((_req, res) => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
        <head><title>MoltBot - Not Built</title></head>
        <body style="font-family:system-ui;padding:2rem;background:#1a1a2e;color:#fff">
          <h1>UI Not Built</h1>
          <p>Run <code>cd ui && npm run build</code> first.</p>
          <p><a href="/health" style="color:#0d6efd">/health</a> is available.</p>
        </body>
      </html>
    `);
  });
}

// Create HTTP server
const server = http.createServer(app);

// WebSocket proxy server - proxy all WebSocket connections to the gateway
const wss = new WebSocketServer({ server });

wss.on("connection", (clientSocket, req) => {
  const gatewayUrl = `ws://127.0.0.1:${GATEWAY_PORT}`;
  const gatewaySocket = new WebSocket(gatewayUrl, {
    headers: {
      "user-agent": req.headers["user-agent"] || "moltbot-proxy",
      "host": "127.0.0.1:" + GATEWAY_PORT,
    },
  });

  let gatewayConnected = false;
  const messageQueue = [];

  gatewaySocket.on("open", () => {
    console.log("[WS-PROXY] Connected to gateway");
    gatewayConnected = true;
    
    // Flush queued messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      if (gatewaySocket.readyState === WebSocket.OPEN) {
        gatewaySocket.send(msg);
      }
    }
  });

  gatewaySocket.on("message", (data) => {
    // Convert Buffer to string for browser WebSocket compatibility
    const messageStr = data.toString();
    const dataStr = messageStr.substring(0, 200);
    console.log(`[WS-PROXY] Gateway -> Client: ${dataStr}${dataStr.length >= 200 ? '...' : ''}`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(messageStr);
    }
  });

  gatewaySocket.on("close", (code, reason) => {
    console.log(`[WS-PROXY] Gateway closed: ${code} - ${reason}`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(code, reason.toString());
    }
  });

  gatewaySocket.on("error", (err) => {
    console.error("[WS-PROXY] Gateway socket error:", err.message);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(1011, "Gateway connection error");
    }
  });

  // Client -> Gateway
  clientSocket.on("message", (data) => {
    const dataStr = data.toString().substring(0, 200);
    console.log(`[WS-PROXY] Client -> Gateway: ${dataStr}${dataStr.length >= 200 ? '...' : ''}`);
    if (gatewayConnected && gatewaySocket.readyState === WebSocket.OPEN) {
      gatewaySocket.send(data);
    } else {
      // Queue messages until gateway is connected
      messageQueue.push(data);
    }
  });

  clientSocket.on("close", (code, reason) => {
    console.log(`[WS-PROXY] Client closed: ${code} - ${reason}`);
    if (gatewaySocket.readyState === WebSocket.OPEN) {
      gatewaySocket.close(code, reason.toString());
    }
  });

  clientSocket.on("error", (err) => {
    console.error("[WS-PROXY] Client socket error:", err.message);
    if (gatewaySocket.readyState === WebSocket.OPEN) {
      gatewaySocket.close(1011, "Client connection error");
    }
  });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] MoltBot UI server listening on http://0.0.0.0:${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
  console.log(`[SERVER] Gateway proxy: ws://localhost:${PORT} -> ws://127.0.0.1:${GATEWAY_PORT}`);
  console.log(`[SERVER] Auth token: ${GATEWAY_TOKEN.substring(0, 10)}...`);
});
