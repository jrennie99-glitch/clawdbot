#!/bin/bash
# Manual Gateway Test
# Tests if gateway can start manually (bypassing supervisor)

echo "=========================================="
echo "MANUAL GATEWAY TEST"
echo "=========================================="
echo ""

echo "Setting environment..."
export CLAWDBOT_GATEWAY_PORT=8001
export CLAWDBOT_GATEWAY_BIND=0.0.0.0
export NODE_ENV=production

echo "Environment set:"
echo "  PORT: $CLAWDBOT_GATEWAY_PORT"
echo "  BIND: $CLAWDBOT_GATEWAY_BIND"
echo "  GATEWAY_PASSWORD: ${GATEWAY_PASSWORD:+SET}"
echo ""

echo "Attempting to start gateway manually..."
echo "Press Ctrl+C to stop"
echo ""

if [ ! -f "/app/moltbot.mjs" ]; then
  echo "ERROR: /app/moltbot.mjs not found!"
  exit 1
fi

node /app/moltbot.mjs gateway --port 8001 --bind 0.0.0.0
