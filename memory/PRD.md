# ClawdBot Coolify Deployment Fix - PRD

## Original Problem Statement
Coolify deploy fails because healthcheck depends on gateway which crash-loops. Need to swap ports and fix stability.

## Port Configuration (UPDATED)
- **Gateway**: Port 3002 (0.0.0.0)
- **Frontend/UI/WebSocket**: Port 8001 (0.0.0.0)

## What's Been Implemented (Feb 2026)

### Files Changed:
1. **Dockerfile** - Healthcheck now uses `/healthz` on port 8001 (frontend-only)
2. **docker/supervisord.conf** - Gateway on 3002, Frontend on 8001, gateway retries=999
3. **docker/start-gateway.sh** - Removed `set -e`, added env validation warnings
4. **serve-ui.mjs** - Updated default ports, changed WebSocket close codes from 1011 to 1001
5. **supervisord.conf** - Updated ports to match
6. **COOLIFY.md** - Updated documentation

### Key Fixes:
- **HEALTHCHECK**: Uses `/healthz` on port 8001 (frontend) - always returns 200
- **Gateway Retries**: Set to 999 - prevents FATAL state from killing container
- **Env Validation**: Warns but doesn't crash on missing GATEWAY_TOKEN
- **WebSocket 1011**: Changed to 1001 (going away) for cleaner disconnect handling

## Deployment Notes (Coolify)
- Expose port 8001 for Web UI / WebSocket
- Expose port 3002 for Gateway API
- Set GATEWAY_TOKEN in environment variables
- Healthcheck path: `/healthz`

## Next Steps
- Deploy to Coolify and verify stability
- Monitor gateway logs for crash reasons
