# MoltBot Security Gateway - PRD

## Original Problem Statement
Upgrade the existing Moltbot/OpenClaw codebase to "SUPER SUPREME GOD MODE" security with:
- Full security module integration (Policy Engine, LLM Router, Secret Redaction, Kill Switch, HITL, Budget Guardrails)
- Security dashboard at `/admin/security`
- Self-setup installer (CLI and UI)
- **Gateway connectivity fix** - Critical blocker where UI couldn't connect to backend

## Architecture

```
/app/
├── serve-ui.mjs            # Express server - UI + WebSocket proxy + Setup API
├── moltbot.mjs             # Main gateway entrypoint
├── dist/
│   └── control-ui/         # Built LitElement UI
├── src/
│   ├── gateway/            # Core gateway (WebSocket server on port 8001)
│   ├── security/           # Security modules (policy, hitl, audit, budget)
│   └── setup/              # Setup engine
├── ui/                     # LitElement frontend source
└── supervisord.conf        # Process management
```

### Service Architecture
- **Frontend** (port 3000): Express server serving static UI + WebSocket proxy
- **Backend** (port 8001): MoltBot gateway with WebSocket support
- **WebSocket Proxy**: Frontend proxies WebSocket connections to backend gateway
- **Auth**: Token-based authentication with auto-injection

## What's Been Implemented

### ✅ Gateway Connectivity (Feb 2, 2026)
- Fixed WebSocket connection between UI and gateway
- **Root Cause**: Node.js ws library sends Buffer objects, but browser expects string data
- **Fix**: Convert Buffer to string in WebSocket proxy before sending to browser
- Both services now managed by supervisor and start automatically
- Auth token auto-injected into UI via serve-ui.mjs

### ✅ Security Module Integration
- Policy Engine, LLM Router, Secret Redaction wired into live execution
- Kill Switch, Lockdown Mode fully functional
- HITL with off/selective/full modes
- Budget Guardrails (per-run, daily, monthly)
- Audit Trail with conversation replay

### ✅ Security Dashboard
- Live admin dashboard at `/admin/security`
- Real-time control of Kill Switch, Lockdown, HITL
- Budget management UI

### ✅ Self-Setup Installer
- CLI wizard via `npm run setup`
- UI wizard at `/setup` with token protection
- Configures admin, LLM providers, security settings

### ✅ 190 Passing Tests
- Unit, integration, and feature tests
- Coverage for all security modules

## Configuration Files

### /root/.moltbot/moltbot.json
```json
{
  "gateway": {
    "mode": "local",
    "bind": "lan", 
    "port": 8001,
    "auth": { "token": "moltbot-preview-token-2024" },
    "controlUi": { "enabled": true, "allowInsecureAuth": true },
    "trustedProxies": ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
  }
}
```

### /etc/supervisor/conf.d/supervisord.conf
- Backend: `node /app/moltbot.mjs gateway --port 8001 --allow-unconfigured`
- Frontend: `node /app/serve-ui.mjs`
- Both autostart=true with autorestart

## Key Technical Decisions

1. **WebSocket Proxy**: Frontend proxies WS to gateway to allow same-origin connections
2. **Token Injection**: Auth token injected into index.html via serve-ui.mjs
3. **Buffer to String**: Critical fix - convert ws Buffer messages to strings for browser
4. **Supervisor Management**: Both services managed together for reliability

## Remaining Tasks

### P1 - Production Hardening
- [ ] Implement secure HTTP headers (CSP, HSTS) - partially done
- [ ] Enable PostgreSQL audit logging

### Future
- [ ] Full E2E test suite for integrated security flow
- [ ] External LLM provider integration (requires API keys)

## 3rd Party Integrations (Ready for Configuration)
- Moonshot Kimi (Kimi K2.5)
- OpenRouter
- Local OpenAI-compatible (Ollama/vLLM)
- Claude (Optional)

## Testing
Run tests: `npm test` or `pnpm test`
Test reports: `/app/src/security/*.test.ts`

## Credentials
- Gateway Token: `moltbot-preview-token-2024` (auto-injected)
- Admin setup via `/setup` wizard
