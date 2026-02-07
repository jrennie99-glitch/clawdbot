#!/bin/bash
# Gateway startup script
# Runs gateway on ports 8001 (healthcheck) and 3002 (main)

set +e

# Defaults
export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"

log() {
  echo "[gateway-wrapper] $1"
}

log "======================================"
log "Starting MoltBot Gateway"
log "Bind: $CLAWDBOT_GATEWAY_BIND"
log "Ports: 8001 (health) + 3002 (main)"
log "======================================"

# Ensure moltbot exists
if [ ! -f "/app/moltbot.mjs" ]; then
  log "ERROR: /app/moltbot.mjs not found"
  while true; do sleep 60; done
fi

########################################
# Start HEALTHCHECK gateway (8001)
########################################
log "Starting gateway on port 8001 (healthcheck)"

CLAWDBOT_GATEWAY_PORT=8001 \
node /app/moltbot.mjs gateway \
  --port 8001 \
  --bind "$CLAWDBOT_GATEWAY_BIND" \
  2>&1 | while IFS= read -r line; do
    echo "[gateway-8001] $line"
  done &

########################################
# Start MAIN gateway (3002)
########################################
log "Starting gateway on port 3002 (main)"

CLAWDBOT_GATEWAY_PORT=3002 \
node /app/moltbot.mjs gateway \
  --port 3002 \
  --bind "$CLAWDBOT_GATEWAY_BIND" \
  2>&1 | while IFS= read -r line; do
    echo "[gateway-3002] $line"
  done

########################################
# If we ever reach here, something died
########################################
exit_code=$?
log "Gateway exited with code $exit_code"

sleep 5
exit 1
