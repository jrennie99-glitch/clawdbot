#!/bin/bash
# Gateway startup with emergency fallback

export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"

# Always print to stdout (goes to supervisor logs)
exec 1>&1
exec 2>&1

echo "=========================================="
echo "[$(date)] GATEWAY STARTUP"
echo "=========================================="

# Check basic requirements
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found!"
    echo "Starting emergency gateway..."
    exec node /app/docker/emergency-gateway.js
fi

NODE_VERSION=$(node --version)
echo "Node.js: ${NODE_VERSION}"

# Check if dist exists
echo "Checking build files..."
if [ ! -f "/app/dist/entry.js" ]; then
    echo "ERROR: /app/dist/entry.js not found!"
    echo "Build is incomplete!"
    echo "Starting emergency gateway..."
    exec node /app/docker/emergency-gateway.js
fi

echo "Build files: OK"

# Try to start main gateway with timeout
echo "Starting main gateway..."
echo "Command: node /app/moltbot.mjs gateway --port ${CLAWDBOT_GATEWAY_PORT} --bind ${CLAWDBOT_GATEWAY_BIND} --allow-unconfigured"

# Start with timeout - if it crashes within 10 seconds, use emergency
timeout 10s node /app/moltbot.mjs gateway \
    --port "${CLAWDBOT_GATEWAY_PORT}" \
    --bind "${CLAWDBOT_GATEWAY_BIND}" \
    --allow-unconfigured 2>&1 &

MAIN_PID=$!
echo "Main gateway PID: ${MAIN_PID}"

# Wait and check
sleep 5
if kill -0 $MAIN_PID 2>/dev/null; then
    echo "Main gateway is running!"
    wait $MAIN_PID
    EXIT_CODE=$?
    echo "Main gateway exited: ${EXIT_CODE}"
    
    # If it exited with error, try emergency
    if [ $EXIT_CODE -ne 0 ]; then
        echo "Main gateway crashed. Starting emergency gateway..."
        exec node /app/docker/emergency-gateway.js
    fi
    exit $EXIT_CODE
else
    echo "Main gateway crashed immediately!"
    wait $MAIN_PID 2>/dev/null
    echo "Starting emergency gateway..."
    exec node /app/docker/emergency-gateway.js
fi
