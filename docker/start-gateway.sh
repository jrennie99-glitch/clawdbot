#!/bin/bash
# Gateway startup script - validates env and starts single gateway instance
# Do NOT add set -e as we want to handle errors gracefully

export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"

echo "[gateway-wrapper] Starting gateway"
echo "[gateway-wrapper] Bind: ${CLAWDBOT_GATEWAY_BIND}"
echo "[gateway-wrapper] Port: ${CLAWDBOT_GATEWAY_PORT}"

# Check if dist folder exists (code must be built)
if [ ! -d "/app/dist" ]; then
  echo "[gateway-wrapper] ERROR: /app/dist folder not found!"
  echo "[gateway-wrapper] The TypeScript code needs to be built before running."
  echo "[gateway-wrapper] Make sure 'pnpm build' runs successfully during Docker build."
  exit 1
fi

# Check if entry.js exists
if [ ! -f "/app/dist/entry.js" ]; then
  echo "[gateway-wrapper] ERROR: /app/dist/entry.js not found!"
  echo "[gateway-wrapper] Build may be incomplete or failed."
  exit 1
fi

echo "[gateway-wrapper] Build check passed: dist/ folder exists"

# Log API key status (not the actual keys)
echo "[gateway-wrapper] GATEWAY_TOKEN: ${GATEWAY_TOKEN:+set}"
echo "[gateway-wrapper] GATEWAY_PASSWORD: ${GATEWAY_PASSWORD:+set}"
echo "[gateway-wrapper] MOONSHOT_API_KEY: ${MOONSHOT_API_KEY:+set}"
echo "[gateway-wrapper] KIMI_API_KEY: ${KIMI_API_KEY:+set}"
echo "[gateway-wrapper] OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:+set}"
echo "[gateway-wrapper] ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+set}"

# Check if port is already in use
echo "[gateway-wrapper] Checking if port ${CLAWDBOT_GATEWAY_PORT} is available..."
if nc -z 127.0.0.1 "${CLAWDBOT_GATEWAY_PORT}" 2>/dev/null; then
  echo "[gateway-wrapper] ERROR: Port ${CLAWDBOT_GATEWAY_PORT} is already in use!"
  echo "[gateway-wrapper] Trying to find what's using it..."
  netstat -tlnp 2>/dev/null | grep "${CLAWDBOT_GATEWAY_PORT}" || ss -tlnp 2>/dev/null | grep "${CLAWDBOT_GATEWAY_PORT}" || true
fi

# Check for moltbot.json config
echo "[gateway-wrapper] Checking for config..."
if [ -f /root/.moltbot/moltbot.json ]; then
  echo "[gateway-wrapper] Config found at /root/.moltbot/moltbot.json"
else
  echo "[gateway-wrapper] WARNING: Config not found at /root/.moltbot/moltbot.json"
fi

# Validate GATEWAY_TOKEN - warn but don't crash
if [ -z "${GATEWAY_TOKEN:-}" ] && [ -z "${GATEWAY_PASSWORD:-}" ]; then
  echo "[gateway-wrapper] WARNING: Neither GATEWAY_TOKEN nor GATEWAY_PASSWORD set - gateway will run in DISABLED mode"
fi

# Error handler
trap 'echo "[gateway-wrapper] Gateway process exited with code $?"' EXIT

# Start gateway with error capture
node /app/moltbot.mjs gateway \
  --port "${CLAWDBOT_GATEWAY_PORT}" \
  --bind "${CLAWDBOT_GATEWAY_BIND}" \
  --allow-unconfigured 2>&1

EXIT_CODE=$?
echo "[gateway-wrapper] Gateway exited with code ${EXIT_CODE}"
exit ${EXIT_CODE}
