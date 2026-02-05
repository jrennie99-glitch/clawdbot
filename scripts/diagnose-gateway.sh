#!/bin/bash
# Gateway Diagnostic Script
# Run this inside your Coolify container to diagnose the issue

echo "=========================================="
echo "MOLTBOT GATEWAY DIAGNOSTICS"
echo "=========================================="
echo ""

echo "1. SUPERVISOR STATUS:"
echo "----------------------------------------"
supervisorctl status
echo ""

echo "2. GATEWAY PROCESS CHECK:"
echo "----------------------------------------"
ps aux | grep -E "gateway|moltbot" | grep -v grep
echo ""

echo "3. PORT CHECK (8001):"
echo "----------------------------------------"
netstat -tlnp | grep 8001 || echo "Port 8001 not listening"
echo ""

echo "4. SUPERVISOR CONFIG IN USE:"
echo "----------------------------------------"
echo "Main config:"
cat /etc/supervisor/supervisord.conf 2>/dev/null | head -20
echo ""
echo "Moltbot config:"
cat /etc/supervisor/conf.d/moltbot.conf 2>/dev/null | head -30
echo ""

echo "5. ROOT SUPERVISOR CONFIG:"
echo "----------------------------------------"
cat /app/supervisord.conf 2>/dev/null | head -30
echo ""

echo "6. AUTOSTART CHECK:"
echo "----------------------------------------"
grep -n "autostart" /app/supervisord.conf /etc/supervisor/conf.d/*.conf 2>/dev/null
echo ""

echo "7. GATEWAY STARTUP SCRIPT:"
echo "----------------------------------------"
ls -la /app/docker/start-gateway.sh 2>/dev/null
head -20 /app/docker/start-gateway.sh 2>/dev/null
echo ""

echo "8. GATEWAY OUTPUT LOGS (last 50 lines):"
echo "----------------------------------------"
tail -50 /var/log/supervisor/gateway.out.log 2>/dev/null || echo "No gateway.out.log"
echo ""

echo "9. GATEWAY ERROR LOGS (last 50 lines):"
echo "----------------------------------------"
tail -50 /var/log/supervisor/gateway.err.log 2>/dev/null || echo "No gateway.err.log"
echo ""

echo "10. ENVIRONMENT VARIABLES:"
echo "----------------------------------------"
env | grep -E "GATEWAY|CLAWDBOT|PORT|NODE_ENV|OPENROUTER" | sed 's/=.*/=***REDACTED***/'
echo ""

echo "11. MOLTBOT.MJS CHECK:"
echo "----------------------------------------"
ls -la /app/moltbot.mjs 2>/dev/null || echo "moltbot.mjs NOT FOUND!"
echo ""

echo "12. HEALTHZ ENDPOINT:"
echo "----------------------------------------"
curl -s http://localhost:3000/healthz 2>/dev/null || echo "Health check failed"
curl -s http://localhost:8001/healthz 2>/dev/null || echo "Gateway health check failed"
echo ""

echo "=========================================="
echo "DIAGNOSTICS COMPLETE"
echo "=========================================="
echo ""
echo "Please share this output for debugging."
