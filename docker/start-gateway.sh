#!/bin/bash
# Gateway startup script with MAXIMUM robustness
# CRITICAL: This script NEVER exits with code 1 - always keeps process alive

set +e  # Don't exit on errors

# Container-safe bind defaults
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-3002}"
export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"

# Log function
log() {
  echo "[gateway-wrapper] $1"
}

# Log startup config
log "=========================================="
log "Gateway Startup Configuration"
log "=========================================="
log "Port: $CLAWDBOT_GATEWAY_PORT"
log "Bind: $CLAWDBOT_GATEWAY_BIND"
log "Gateway Password: ${GATEWAY_PASSWORD:+SET (${#GATEWAY_PASSWORD} chars)}"
log "Gateway Token: ${GATEWAY_TOKEN:+SET (${#GATEWAY_TOKEN} chars)}"
log "OpenRouter API Key: ${OPENROUTER_API_KEY:+SET}"
log "Groq API Key: ${GROQ_API_KEY:+SET}"
log "Anthropic API Key: ${ANTHROPIC_API_KEY:+SET}"
log "Node Environment: ${NODE_ENV:-not set}"
log "=========================================="

# Check if gateway can even start
if [ ! -f "/app/moltbot.mjs" ]; then
  log "ERROR: /app/moltbot.mjs not found!"
  log "Gateway cannot start - keeping process alive for debugging"
  # Keep alive forever
  while true; do
    log "Waiting... (moltbot.mjs missing)"
    sleep 60
  done
fi

# Try to start gateway with maximum error handling
attempt=0
max_attempts=999999  # Effectively infinite

while true; do
  attempt=$((attempt + 1))
  log "Starting gateway (attempt #$attempt)..."# Start secondary gateway on 8001 (background)
CLAWDBOT_GATEWAY_PORT=8001 node /app/moltbot.mjs gateway \
  --port 8001 \
  --bind "$CLAWDBOT_GATEWAY_BIND" \
  2>&1 | while IFS= read -r line; do
    echo "[gateway-8001] $line"
  done &
  CLAWDBOT_GATEWAY_PORT=3002 node /app/moltbot.mjs gateway \
  --port 3002 \
  --bind "$CLAWDBOT_GATEWAY_BIND" \
  2>&1 | while IFS= read -r line; do
    echo "[gateway-3002] $line"
  done
  
  

    
     
    
  
  exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    log "Gateway exited cleanly (code 0)"
  else
    log "Gateway exited with code $exit_code"
  fi
  
  # Check if we should restart
  if [ $exit_code -ne 0 ]; then
    log "Gateway failed - will restart in 5 seconds..."
    sleep 5
  else
    log "Gateway stopped normally - will restart in 2 seconds..."
    sleep 2
  fi
  
  # Check for critical errors that mean we should give up
  if [ ! -f "/app/moltbot.mjs" ]; then
    log "CRITICAL: moltbot.mjs disappeared - entering wait mode"
    while true; do
      sleep 60
      log "Still waiting (moltbot.mjs missing)..."
    done
  fi
done

# This should never be reached, but just in case
log "Gateway wrapper exiting unexpectedly - entering infinite wait"
while true; do
  sleep 60
  log "Still alive (fallback loop)..."
done

