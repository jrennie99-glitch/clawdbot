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
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Configuration from environment
// Frontend/UI on PORT (default 3002), Gateway on GATEWAY_PORT (default 8001)
const PORT = parseInt(process.env.PORT || "3002", 10);
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "8001", 10);

// CANONICAL TOKEN SOURCE: GATEWAY_TOKEN only - no fallbacks
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "";

// Validate token at startup - warn but don't crash to prevent container restart loops
if (!GATEWAY_TOKEN) {
  console.warn("[WARNING] GATEWAY_TOKEN environment variable is not set.");
  console.warn("[WARNING] Set GATEWAY_TOKEN in Coolify and restart for full functionality.");
}

// LLM Provider status (check which keys are configured)
const PROVIDER_STATUS = {
  openai: !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  google: !!process.env.GOOGLE_API_KEY,
  moonshot: !!process.env.MOONSHOT_API_KEY || !!process.env.KIMI_API_KEY,
  openrouter: !!process.env.OPENROUTER_API_KEY,
  ollama: !!process.env.OLLAMA_BASE_URL,
};

// Log provider status at startup (no secrets)
console.log("[STARTUP] LLM Provider Status:");
Object.entries(PROVIDER_STATUS).forEach(([provider, configured]) => {
  console.log(`  - ${provider}: ${configured ? "configured" : "NOT configured (missing API key)"}`);
});

app.use(express.json());

// Disable X-Powered-By header
app.disable("x-powered-by");

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ws: wss: https:; img-src 'self' data: blob: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  // HSTS only if behind HTTPS proxy
  if (req.headers["x-forwarded-proto"] === "https" || req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Minimal healthz endpoint for Docker HEALTHCHECK (returns 200 OK if server is up)
app.get("/healthz", (_req, res) => {
  res.status(200).send("OK");
});

// Health endpoint - checks actual gateway connectivity
app.get("/health", async (_req, res) => {
  let gatewayStatus = "unknown";
  let gatewayHealthy = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    gatewayHealthy = response.ok;
    gatewayStatus = gatewayHealthy ? "connected" : "unhealthy";
  } catch {
    gatewayStatus = "unreachable";
  }

  const tokenConfigured = !!GATEWAY_TOKEN;
  const overallHealthy = gatewayHealthy && tokenConfigured;

  res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
    gateway: {
      status: gatewayStatus,
      healthy: gatewayHealthy
    },
    token: {
      configured: tokenConfigured
    },
    providers: PROVIDER_STATUS
  });
});

// Gateway health endpoint
app.get("/gateway/health", async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      res.json({ status: "ok", gateway: "connected" });
    } else {
      res.status(503).json({ status: "error", gateway: "unhealthy" });
    }
  } catch {
    res.status(503).json({ status: "error", gateway: "unreachable" });
  }
});

// Provider status endpoint
app.get("/api/providers/status", (_req, res) => {
  res.json({
    providers: PROVIDER_STATUS,
    configured: Object.entries(PROVIDER_STATUS)
      .filter(([, v]) => v)
      .map(([k]) => k)
  });
});

// API status
app.get("/api/status", (_req, res) => {
  res.json({
    gateway: "standalone",
    configured: !!GATEWAY_TOKEN,
    tokenConfigured: !!GATEWAY_TOKEN,
    providers: PROVIDER_STATUS
  });
});

// Setup endpoints - locked in production
app.get("/api/setup/status", (_req, res) => {
  res.json({ configured: true, locked: true, production: true });
});

app.post("/api/setup/validate-token", (_req, res) => {
  res.status(403).json({ error: "Setup disabled in production mode" });
});

app.post("/api/setup/apply", (_req, res) => {
  res.status(403).json({ error: "Setup disabled in production mode" });
});

app.post("/api/setup/unlock", (_req, res) => {
  res.status(403).json({ error: "Setup modification disabled in production mode" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    configured: true,
    tokenConfigured: !!GATEWAY_TOKEN,
    providers: PROVIDER_STATUS
  });
});

// UI dist path
const uiDistPath = path.join(__dirname, "dist/control-ui");

// Generate modified index.html with injected token and config
function getIndexHtml(urlToken) {
  const indexPath = path.join(uiDistPath, "index.html");
  if (!fs.existsSync(indexPath)) return null;
  
  let html = fs.readFileSync(indexPath, "utf-8");
  
  // Use URL token if provided, otherwise use env token
  const effectiveToken = urlToken || GATEWAY_TOKEN;
  const tokenMissing = !effectiveToken;
  
  // Inject configuration script
  const configScript = `
<script>
  (function() {
    var KEY = "moltbot.control.settings.v1";
    var urlParams = new URLSearchParams(window.location.search);
    var urlToken = urlParams.get('token');
    var envToken = "${effectiveToken}";
    
    // If token in URL, save to localStorage and remove from URL
    if (urlToken) {
      try {
        var settings = JSON.parse(localStorage.getItem(KEY) || '{}');
        settings.token = urlToken;
        settings.gatewayUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host;
        localStorage.setItem(KEY, JSON.stringify(settings));
        // Remove token from URL without reload
        var newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      } catch (e) {}
    }
    
    // ALWAYS sync token from environment if available
    // This ensures token mismatch is resolved on page load
    try {
      var saved = localStorage.getItem(KEY);
      var settings = saved ? JSON.parse(saved) : {};
      
      // If env token is set and different from stored token, update it
      if (envToken && settings.token !== envToken) {
        console.log('[MoltBot] Syncing token from server configuration');
        settings.token = envToken;
      }
      
      settings.gatewayUrl = settings.gatewayUrl || (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host;
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('[MoltBot] Failed to sync token:', e);
    }
    
    // Show warning banner if token is missing
    var tokenMissing = ${tokenMissing};
    if (tokenMissing && !urlToken) {
      document.addEventListener('DOMContentLoaded', function() {
        var banner = document.createElement('div');
        banner.id = 'token-warning';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc3545;color:white;padding:12px;text-align:center;z-index:9999;font-family:system-ui;';
        banner.innerHTML = '<strong>⚠️ GATEWAY_TOKEN not configured.</strong> Set GATEWAY_TOKEN in Coolify environment variables and restart. Or append <code>?token=YOUR_TOKEN</code> to this URL.';
        document.body.prepend(banner);
      });
    }
    
    // Expose provider status to UI
    window.__MOLTBOT_PROVIDERS__ = ${JSON.stringify(PROVIDER_STATUS)};
  })();
</script>`;
  
  html = html.replace("<head>", "<head>" + configScript);
  return html;
}

if (fs.existsSync(uiDistPath)) {
  // Root route with token injection
  app.get("/", (req, res) => {
    const urlToken = req.query.token;
    const html = getIndexHtml(urlToken);
    if (html) {
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } else {
      res.status(500).send("UI not built");
    }
  });

  // Static assets
  app.use("/assets", express.static(path.join(uiDistPath, "assets")));
  app.use("/favicon.ico", express.static(path.join(uiDistPath, "favicon.ico")));

  // SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/gateway/") || req.path === "/health") {
      return res.status(404).json({ error: "Not found" });
    }
    const urlToken = req.query.token;
    const html = getIndexHtml(urlToken);
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
        <head><title>MoltBot - UI Not Built</title></head>
        <body style="font-family:system-ui;padding:2rem;background:#1a1a2e;color:#fff">
          <h1>UI Not Built</h1>
          <p>Run the build process first.</p>
        </body>
      </html>
    `);
  });
}

// Create HTTP server
const server = http.createServer(app);

// WebSocket proxy
const wss = new WebSocketServer({ server });

wss.on("connection", (clientSocket, req) => {
  const gatewayUrl = `ws://127.0.0.1:${GATEWAY_PORT}`;
  const gatewaySocket = new WebSocket(gatewayUrl, {
    headers: {
      "user-agent": req.headers["user-agent"] || "moltbot-proxy",
      "host": `127.0.0.1:${GATEWAY_PORT}`,
    },
  });

  let gatewayConnected = false;
  const messageQueue = [];

  gatewaySocket.on("open", () => {
    gatewayConnected = true;
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      if (gatewaySocket.readyState === WebSocket.OPEN) {
        gatewaySocket.send(msg);
      }
    }
  });

  gatewaySocket.on("message", (data) => {
    const messageStr = data.toString();
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(messageStr);
    }
  });

  gatewaySocket.on("close", (code, reason) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(code, reason.toString());
    }
  });

  gatewaySocket.on("error", (err) => {
    console.error(`[WebSocket Proxy] Gateway connection error: ${err.message}`);
    console.error(`[WebSocket Proxy] Trying to connect to: ${gatewayUrl}`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      // Use 1001 (going away) instead of 1011 to avoid client-side errors
      clientSocket.close(1001, "Gateway temporarily unavailable - check gateway logs");
    }
  });

  clientSocket.on("message", (data) => {
    if (gatewayConnected && gatewaySocket.readyState === WebSocket.OPEN) {
      gatewaySocket.send(data);
    } else {
      messageQueue.push(data);
    }
  });

  clientSocket.on("close", (code, reason) => {
    if (gatewaySocket.readyState === WebSocket.OPEN) {
      gatewaySocket.close(code, reason.toString());
    }
  });

  clientSocket.on("error", () => {
    if (gatewaySocket.readyState === WebSocket.OPEN) {
      // Use 1001 (going away) instead of 1011 to avoid client-side errors
      gatewaySocket.close(1001, "Client disconnected");
    }
  });
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit - keep server running
});

// Start server
try {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] MoltBot UI server listening on port ${PORT}`);
    console.log(`[SERVER] Gateway proxy target: ws://127.0.0.1:${GATEWAY_PORT}`);
    console.log(`[SERVER] Token configured: ${!!GATEWAY_TOKEN}`);
    
    // Check if gateway is reachable (async import for ES module compatibility)
    const checkGateway = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/healthz`);
        console.log(`[SERVER] Gateway health check: ${response.status === 200 ? 'OK' : 'UNHEALTHY'}`);
      } catch (err) {
        console.error(`[SERVER] Gateway NOT reachable at port ${GATEWAY_PORT}: ${err.message}`);
        console.error(`[SERVER] Make sure gateway is running. Check supervisorctl status.`);
      }
    };
    setTimeout(checkGateway, 2000);
  });

  server.on('error', (err) => {
    console.error('[SERVER] HTTP server error:', err);
    // Don't exit - try to recover
  });
} catch (err) {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
}
