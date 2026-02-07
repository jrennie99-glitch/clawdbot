#!/bin/bash
# Gateway startup script - validates env and starts single gateway instance
# Do NOT add set -e as we want to handle errors gracefully

export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"

echo "[gateway-wrapper] Starting gateway"
echo "[gateway-wrapper] Bind: ${CLAWDBOT_GATEWAY_BIND}"
echo "[gateway-wrapper] Port: ${CLAWDBOT_GATEWAY_PORT}"

# Validate GATEWAY_TOKEN - warn but don't crash
if [ -z "${GATEWAY_TOKEN:-}" ]; then
  echo "[gateway-wrapper] WARNING: GATEWAY_TOKEN not set - gateway may not authenticate properly"
  echo "[gateway-wrapper] Set GATEWAY_TOKEN in Coolify environment variables"
fi

# Start gateway - exec replaces shell for clean supervisor management
exec node /app/moltbot.mjs gateway \
  --port "${CLAWDBOT_GATEWAY_PORT}" \
  --bind "${CLAWDBOT_GATEWAY_BIND}"
