#!/bin/bash
# Gateway startup script - validates env and starts single gateway instance
# Do NOT add set -e as we want to handle errors gracefully

export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"

echo "========================================="
echo "[gateway-wrapper] Starting gateway"
echo "[gateway-wrapper] Bind: ${CLAWDBOT_GATEWAY_BIND}"
echo "[gateway-wrapper] Port: ${CLAWDBOT_GATEWAY_PORT}"
echo "========================================="

# Check if dist folder exists (code must be built)
if [ ! -d "/app/dist" ]; then
  echo "[gateway-wrapper] ❌ ERROR: /app/dist folder not found!"
  echo "[gateway-wrapper] The TypeScript code needs to be built before running."
  echo "[gateway-wrapper] Build should happen in Dockerfile with: pnpm build"
  echo ""
  echo "[gateway-wrapper] Attempting to show build error..."
  ls -la /app/ | head -20
  echo ""
  echo "[gateway-wrapper] Trying to start anyway in 5 seconds..."
  sleep 5
fi

# Check if entry.js exists
if [ ! -f "/app/dist/entry.js" ]; then
  echo "[gateway-wrapper] ⚠️ WARNING: /app/dist/entry.js not found!"
  echo "[gateway-wrapper] Build may be incomplete."
  echo "[gateway-wrapper] Available files in /app/:"
  ls -la /app/ 2>/dev/null | head -10 || echo "Cannot list /app/"
  echo ""
  echo "[gateway-wrapper] Attempting to continue anyway..."
fi

# Log API key status (not the actual keys)
echo "[gateway-wrapper] Environment check:"
echo "  GATEWAY_TOKEN: ${GATEWAY_TOKEN:+✅ set}${GATEWAY_TOKEN:-❌ not set}"
echo "  GATEWAY_PASSWORD: ${GATEWAY_PASSWORD:+✅ set}${GATEWAY_PASSWORD:-❌ not set}"
echo "  MOONSHOT_API_KEY: ${MOONSHOT_API_KEY:+✅ set}${MOONSHOT_API_KEY:-❌ not set}"

# Check if port is already in use
echo "[gateway-wrapper] Checking port ${CLAWDBOT_GATEWAY_PORT}..."
if nc -z 127.0.0.1 "${CLAWDBOT_GATEWAY_PORT}" 2>/dev/null; then
  echo "[gateway-wrapper] ⚠️ WARNING: Port ${CLAWDBOT_GATEWAY_PORT} is already in use!"
  netstat -tlnp 2>/dev/null | grep "${CLAWDBOT_GATEWAY_PORT}" || true
fi

# Check for moltbot.json config
if [ -f /root/.moltbot/moltbot.json ]; then
  echo "[gateway-wrapper] ✅ Config found at /root/.moltbot/moltbot.json"
else
  echo "[gateway-wrapper] ℹ️ No config at /root/.moltbot/moltbot.json (will use defaults)"
fi

# Warning about auth
if [ -z "${GATEWAY_TOKEN:-}" ] && [ -z "${GATEWAY_PASSWORD:-}" ]; then
  echo "[gateway-wrapper] ⚠️ No GATEWAY_TOKEN or GATEWAY_PASSWORD set - gateway will run in DISABLED mode"
fi

# Main startup with retry logic
echo ""
echo "[gateway-wrapper] 🚀 Starting gateway process..."
echo "========================================="

MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "[gateway-wrapper] Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES"
  
  # Try to start gateway
  if node /app/moltbot.mjs gateway \
    --port "${CLAWDBOT_GATEWAY_PORT}" \
    --bind "${CLAWDBOT_GATEWAY_BIND}" \
    --allow-unconfigured 2>&1; then
    echo "[gateway-wrapper] Gateway exited normally"
    exit 0
  else
    EXIT_CODE=$?
    echo "[gateway-wrapper] ❌ Gateway crashed with exit code ${EXIT_CODE}"
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "[gateway-wrapper] Retrying in 3 seconds..."
      sleep 3
    fi
  fi
done

echo "[gateway-wrapper] ❌ Gateway failed after $MAX_RETRIES attempts"
echo "[gateway-wrapper] Check logs at /var/log/supervisor/gateway.err.log"
exit 1
