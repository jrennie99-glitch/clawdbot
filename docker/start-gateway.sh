#!/bin/bash
# Gateway startup script - bulletproof version with safe fallbacks
# Exit immediately on error but with detailed logging

set -x  # Enable debug mode to see every command

export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"

echo "========================================="
echo "GATEWAY STARTUP DEBUG"
echo "========================================="
echo "Date: $(date)"
echo "Node version: $(node --version 2>/dev/null || echo 'NOT FOUND')"
echo "PWD: $(pwd)"
echo "CLAWDBOT_GATEWAY_BIND: ${CLAWDBOT_GATEWAY_BIND}"
echo "CLAWDBOT_GATEWAY_PORT: ${CLAWDBOT_GATEWAY_PORT}"

# Check Node.js
echo ""
echo "--- Checking Node.js ---"
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found in PATH"
    echo "PATH: ${PATH}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "Node.js version: ${NODE_VERSION}"

# Check if dist exists
echo ""
echo "--- Checking Build Files ---"
if [ ! -d "/app/dist" ]; then
    echo "ERROR: /app/dist directory not found!"
    echo "Contents of /app:"
    ls -la /app/ 2>/dev/null || echo "Cannot list /app"
    
    # EMERGENCY: Try to build now
    echo ""
    echo "Attempting emergency build..."
    cd /app
    if [ -f "package.json" ]; then
        echo "Running pnpm install..."
        pnpm install --frozen-lockfile 2>&1 || npm install 2>&1 || echo "Install failed"
        
        echo "Running pnpm build..."
        pnpm build 2>&1 || echo "Build failed"
    fi
    
    # Check again
    if [ ! -d "/app/dist" ]; then
        echo "CRITICAL: Build failed or dist still missing"
        echo "Starting HTTP server as fallback..."
        
        # Start a minimal HTTP server as emergency fallback
        node -e "
            const http = require('http');
            const server = http.createServer((req, res) => {
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    status: 'emergency_mode',
                    message: 'Gateway build files missing',
                    error: 'dist/ folder not found'
                }));
            });
            server.listen(${CLAWDBOT_GATEWAY_PORT}, '${CLAWDBOT_GATEWAY_BIND}', () => {
                console.log('EMERGENCY server running on port ${CLAWDBOT_GATEWAY_PORT}');
            });
        " &
        
        # Keep script running
        sleep infinity
        exit 0
    fi
fi

if [ ! -f "/app/dist/entry.js" ]; then
    echo "ERROR: /app/dist/entry.js not found!"
    echo "Contents of /app/dist:"
    ls -la /app/dist/ 2>/dev/null || echo "Cannot list /app/dist"
fi

echo "Build files: OK"

# Check config
echo ""
echo "--- Checking Config ---"
if [ -f "/root/.moltbot/moltbot.json" ]; then
    echo "Config exists: /root/.moltbot/moltbot.json"
    cat /root/.moltbot/moltbot.json | head -20
else
    echo "No config found - will use defaults"
    mkdir -p /root/.moltbot
fi

# Check environment
echo ""
echo "--- Environment Variables ---"
echo "GATEWAY_TOKEN: ${GATEWAY_TOKEN:+SET}${GATEWAY_TOKEN:-NOT SET}"
echo "GATEWAY_PASSWORD: ${GATEWAY_PASSWORD:+SET}${GATEWAY_PASSWORD:-NOT SET}"
echo "MOONSHOT_API_KEY: ${MOONSHOT_API_KEY:+SET}${MOONSHOT_API_KEY:-NOT SET}"
echo "OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:+SET}${OPENROUTER_API_KEY:-NOT SET}"
echo "NODE_ENV: ${NODE_ENV:-not set}"

# Check port
echo ""
echo "--- Checking Port ${CLAWDBOT_GATEWAY_PORT} ---"
if command -v netstat &> /dev/null; then
    netstat -tlnp 2>/dev/null | grep ":${CLAWDBOT_GATEWAY_PORT} " || echo "Port appears free"
elif command -v ss &> /dev/null; then
    ss -tlnp 2>/dev/null | grep ":${CLAWDBOT_GATEWAY_PORT} " || echo "Port appears free"
else
    echo "Cannot check port (no netstat or ss)"
fi

# Start gateway with maximum error capture
echo ""
echo "========================================="
echo "STARTING GATEWAY"
echo "========================================="

cd /app

# Try to start, capture all output
node /app/moltbot.mjs gateway \
    --port "${CLAWDBOT_GATEWAY_PORT}" \
    --bind "${CLAWDBOT_GATEWAY_BIND}" \
    --allow-unconfigured 2>&1 &

PID=$!
echo "Gateway started with PID: ${PID}"

# Wait a bit and check if still running
sleep 5

if kill -0 $PID 2>/dev/null; then
    echo "Gateway is running (PID: ${PID})"
    wait $PID
    EXIT_CODE=$?
    echo "Gateway exited with code: ${EXIT_CODE}"
    exit ${EXIT_CODE}
else
    echo "ERROR: Gateway crashed within 5 seconds"
    wait $PID 2>/dev/null
    EXIT_CODE=$?
    echo "Exit code: ${EXIT_CODE}"
    
    # Try once more
    echo ""
    echo "Retrying in 3 seconds..."
    sleep 3
    
    node /app/moltbot.mjs gateway \
        --port "${CLAWDBOT_GATEWAY_PORT}" \
        --bind "${CLAWDBOT_GATEWAY_BIND}" \
        --allow-unconfigured 2>&1
    
    exit $?
fi
