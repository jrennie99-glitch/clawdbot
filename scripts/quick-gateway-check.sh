#!/bin/bash
# Quick Gateway Status Check

echo "Checking Gateway Status..."
echo ""

# Check if gateway process is running
echo "1. Gateway Process:"
if ps aux | grep -E "moltbot.*gateway" | grep -v grep > /dev/null; then
    echo "   ✅ Gateway process is running"
    ps aux | grep -E "moltbot.*gateway" | grep -v grep
else
    echo "   ❌ Gateway process NOT running"
fi
echo ""

# Check if port 8001 is listening
echo "2. Port 8001:"
if netstat -tln 2>/dev/null | grep ":8001 " > /dev/null; then
    echo "   ✅ Port 8001 is listening"
    netstat -tln | grep ":8001 "
else
    echo "   ❌ Port 8001 is NOT listening"
fi
echo ""

# Check gateway endpoint
echo "3. Gateway Endpoint (/healthz):"
if curl -fsS http://127.0.0.1:8001/healthz 2>/dev/null; then
    echo ""
    echo "   ✅ Gateway /healthz responds"
else
    echo "   ❌ Gateway /healthz does NOT respond"
fi
echo ""

# Check supervisor status
echo "4. Supervisor Status:"
supervisorctl status 2>/dev/null || echo "   (Supervisor not available)"
echo ""

# Quick recommendation
echo "=========================================="
if ps aux | grep -E "moltbot.*gateway" | grep -v grep > /dev/null && \
   netstat -tln 2>/dev/null | grep ":8001 " > /dev/null; then
    echo "✅ Gateway appears to be RUNNING"
    echo "If WebSocket still shows error 1011:"
    echo "  1. Check GATEWAY_TOKEN or GATEWAY_PASSWORD is set"
    echo "  2. Check browser console for connection details"
    echo "  3. Verify WebSocket URL matches deployment URL"
else
    echo "❌ Gateway is NOT running properly"
    echo "Next steps:"
    echo "  1. Check logs: tail -100 /var/log/supervisor/gateway.err.log"
    echo "  2. Try manual start: bash /app/scripts/test-gateway-manual.sh"
    echo "  3. Check supervisor: supervisorctl status gateway"
fi
echo "=========================================="
