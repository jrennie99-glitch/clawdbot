#!/bin/bash
set -euo pipefail

export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"

echo "[gateway-wrapper] Starting gateway"
echo "[gateway-wrapper] Bind: ${CLAWDBOT_GATEWAY_BIND}"
echo "[gateway-wrapper] Port: ${CLAWDBOT_GATEWAY_PORT}"

exec node /app/moltbot.mjs gateway \
  --port "${CLAWDBOT_GATEWAY_PORT}" \
  --bind "${CLAWDBOT_GATEWAY_BIND}"
