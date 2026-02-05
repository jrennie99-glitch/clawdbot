#!/bin/bash
# Gateway startup script with safe defaults
# CRITICAL: Prevents crash when env vars are missing

set -e

# Container-safe bind defaults
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"
export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"

# Log startup config
echo "[gateway] Starting with:"
echo "  Port: $CLAWDBOT_GATEWAY_PORT"
echo "  Bind: $CLAWDBOT_GATEWAY_BIND"
echo "  Gateway Password: ${GATEWAY_PASSWORD:+SET}"
echo "  Gateway Token: ${GATEWAY_TOKEN:+SET}"

# Start gateway
exec node /app/moltbot.mjs gateway \
  --port "$CLAWDBOT_GATEWAY_PORT" \
  --bind "$CLAWDBOT_GATEWAY_BIND"
