# ClawdBot Coolify Deployment Fix - PRD

## Original Problem Statement
Coolify deploy fails because Dockerfile HEALTHCHECK curls 127.0.0.1:8001 and fails. Supervisor shows frontend stays RUNNING, but gateway exits repeatedly and enters FATAL. When gateway dies, nothing listens on 8001, so healthcheck fails and Coolify rolls back.

## What's Been Implemented (Feb 2026)

### Files Changed:
1. **Dockerfile** - Fixed HEALTHCHECK to only check frontend (port 3002) instead of both services
2. **docker/supervisord.conf** - Set frontend PORT=3002 in environment
3. **supervisord.conf** - Set frontend PORT=3002 in environment  
4. **serve-ui.mjs** - Added `/healthz` minimal health endpoint
5. **COOLIFY.md** - Updated documentation with correct port 3002

### Key Fixes:
- **HEALTHCHECK**: Now only checks `http://127.0.0.1:3002/health` (frontend only)
- **Frontend Port**: Configured to listen on 3002 via supervisor environment
- **Gateway**: Remains on port 8001, single instance via start-gateway.sh (already correct)
- **Added /healthz endpoint**: Simple 200 OK response for basic health checks

## Architecture
- Frontend: Express server on port 3002 (serve-ui.mjs)
- Gateway: Node.js gateway on port 8001 (moltbot.mjs)
- Process Manager: Supervisor (manages both processes)

## Deployment Notes (Coolify)
- Expose/publish port 3002 for web UI
- Expose/publish port 8001 for gateway API (internal or public)
- Route domain to port 3002
- Healthcheck uses /health endpoint on frontend only

## Next Steps
- Test deployment on Coolify
- Verify gateway stability under load
- Monitor for any remaining FATAL states in gateway

## Backlog
- P1: Add gateway healthcheck retries with backoff
- P2: Add Prometheus metrics endpoint
