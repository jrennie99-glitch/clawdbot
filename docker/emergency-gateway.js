#!/usr/bin/env node
// Emergency minimal gateway that always works
// This is a fallback when the main gateway crashes

const http = require('http');
const PORT = process.env.CLAWDBOT_GATEWAY_PORT || 8001;
const BIND = process.env.CLAWDBOT_GATEWAY_BIND || '0.0.0.0';

console.log(`[EMERGENCY GATEWAY] Starting on ${BIND}:${PORT}`);
console.log(`[EMERGENCY GATEWAY] This is a fallback - main gateway is not working`);

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'emergency_mode',
      message: 'Emergency gateway running - main gateway crashed',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  res.writeHead(503);
  res.end(JSON.stringify({
    error: 'Emergency mode - limited functionality',
    message: 'Main gateway is not running. Check logs.'
  }));
});

server.listen(PORT, BIND, () => {
  console.log(`[EMERGENCY GATEWAY] Running at http://${BIND}:${PORT}`);
  console.log(`[EMERGENCY GATEWAY] Health check: http://${BIND}:${PORT}/healthz`);
});

// Keep alive
setInterval(() => {
  console.log('[EMERGENCY GATEWAY] Still alive at', new Date().toISOString());
}, 30000);

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('[EMERGENCY GATEWAY] Error:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[EMERGENCY GATEWAY] Rejection:', reason);
});
