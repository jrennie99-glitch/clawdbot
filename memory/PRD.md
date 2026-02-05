# MoltBot - PRD (Product Requirements Document)

## Original Problem Statement

1. **LLM Provider Reliability**: Fix "stuck writing forever" behavior when switching providers (Groq, Haiku, etc.). Make MoltBot run FAST + RELIABLE with cheaper/open-source models (Groq/OpenRouter/Ollama).

2. **Cybersecurity Defense System**: Harden MoltBot against real-world attacks (API abuse, gateway hijacking, brute force, DoS-lite, unauthorized access) while keeping it fast and stable.

## User Personas

- **Self-hosters**: Deploy on Coolify/Docker, want cheap/fast inference with security
- **Privacy-conscious users**: Use local Ollama, need reliable timeouts and lockdown modes
- **Budget users**: Prefer Groq free tier over Claude API costs

## Core Requirements (Static)

### LLM Provider Reliability
| Requirement | Status |
|-------------|--------|
| Server-side request timeout (default 15s) | ✅ Implemented |
| Max retries with fail-fast (default 1) | ✅ Implemented |
| LLM_STREAMING=false default | ✅ Implemented |
| OpenAI-compatible provider support | ✅ Implemented |
| Provider status panel | ✅ Implemented |
| Model test button | ✅ Implemented |
| User-friendly error messages | ✅ Implemented |
| Groq/OpenRouter presets | ✅ Implemented |

### Cybersecurity Defense
| Requirement | Status |
|-------------|--------|
| Request Firewall (Mini-WAF) | ✅ Implemented |
| Rate Limiting (per-IP, per-session) | ✅ Implemented |
| Gateway Protection | ✅ Implemented |
| Attack Detection + Auto-blocking | ✅ Implemented |
| Provider Safety (timeouts) | ✅ Implemented |
| Lockdown Mode | ✅ Implemented |
| Security Dashboard | ✅ Implemented |
| ENV-based Config | ✅ Implemented |

## What's Been Implemented

### 2026-02-05 - LLM Provider Reliability

**New Files:**
- `/app/src/agents/llm-config.ts` - LLM configuration module with provider status
- `/app/src/gateway/server-methods/providers.ts` - Provider status/test gateway handlers

**Modified Files:**
- `/app/src/agents/defaults.ts` - Changed defaults to Groq, added timeout/streaming config
- `/app/src/agents/timeout.ts` - Use new DEFAULT_LLM_TIMEOUT_MS (15s vs old 600s)
- `/app/src/gateway/server-methods.ts` - Added providersHandlers
- `/app/src/gateway/server-methods-list.ts` - Added providers.status, providers.test methods
- `/app/docker/moltbot.json` - Added Groq/OpenRouter/Ollama provider configs with fallbacks
- `/app/env.example` - Full env var documentation

### 2026-02-05 - Cybersecurity Defense System

**New Files:**
- `/app/src/security/firewall.ts` - Request firewall with rate limiting, IP blocking
- `/app/src/security/gateway-protection.ts` - Gateway authentication and connection tracking
- `/app/src/security/lockdown-mode.ts` - Lockdown and emergency mode controls
- `/app/src/security/integration/dashboard-handlers.ts` - Security dashboard gateway handlers

**Modified Files:**
- `/app/src/gateway/server-methods.ts` - Added securityDashboardHandlers
- `/app/src/gateway/server-methods-list.ts` - Added security.* methods
- `/app/env.example` - Added security env vars
- `/app/docs/DEPLOY_COOLIFY.md` - Added security configuration guide
- `/app/CHANGELOG.md` - Documented all changes

## New Gateway Endpoints

### LLM Providers
- `providers.status` - Returns configured providers with status
- `providers.test` - Tests providers with latency measurement

### Security Dashboard (Internal Only)
- `security.dashboard` - Complete security overview
- `security.blocked.list` - List blocked IPs
- `security.blocked.add` - Manually block an IP
- `security.blocked.remove` - Unblock an IP
- `security.incidents.list` - Security incident log
- `security.gateway.connections` - Active gateway connections
- `security.lockdown.toggle` - Enable/disable lockdown
- `security.lockdown.status` - Get lockdown status
- `security.admin.check` - Check if user is admin

## New Environment Variables

### LLM Configuration
- `DEFAULT_LLM_PROVIDER` (default: groq)
- `DEFAULT_MODEL` (default: llama-3.1-8b-instant)
- `LLM_STREAMING` (default: false)
- `LLM_REQUEST_TIMEOUT_MS` (default: 15000)
- `LLM_MAX_RETRIES` (default: 1)
- `GROQ_API_KEY`, `OPENROUTER_API_KEY`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

### Security Configuration
- `SECURITY_FIREWALL` (default: true)
- `SECURITY_STRICT_MODE` (default: false)
- `RATE_LIMIT_API_PER_MINUTE` (default: 60)
- `RATE_LIMIT_LOGIN_PER_HOUR` (default: 5)
- `RATE_LIMIT_WS_PER_IP` (default: 3)
- `AUTO_BLOCK_DURATION_MS` (default: 1800000)
- `MAX_FAILED_AUTH_ATTEMPTS` (default: 5)
- `GATEWAY_PASSWORD_REQUIRED`, `GATEWAY_PASSWORD`
- `GATEWAY_MAX_CONNECTIONS` (default: 1000)
- `SECURITY_LOCKDOWN`, `SECURITY_ADMIN_EMAIL`
- `SECURITY_EMERGENCY`, `KILL_SWITCH`

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Fix default timeout from 600s to 15s
- [x] Disable streaming by default
- [x] Change default provider from anthropic to groq
- [x] Add provider status endpoint
- [x] Request firewall with rate limiting
- [x] Auto-blocking for abusive IPs
- [x] Gateway authentication enforcement
- [x] Lockdown mode

### P1 (High) - DONE
- [x] Add provider test endpoint
- [x] Document Groq/OpenRouter presets
- [x] Update moltbot.json with failover config
- [x] User-friendly error formatting
- [x] Security dashboard endpoints
- [x] Attack pattern detection
- [x] Security documentation

### P2 (Medium) - Future
- [ ] Provider health check on gateway startup
- [ ] Auto-select fastest provider based on test results
- [ ] Streaming retry with non-streaming fallback
- [ ] Provider latency history tracking
- [ ] IP geolocation for blocking
- [ ] Threat intelligence integration

### P3 (Low) - Future
- [ ] UI provider selection dropdown
- [ ] Visual latency indicator in chat
- [ ] Per-session provider override
- [ ] Cost tracking per provider
- [ ] Security dashboard UI component
- [ ] Automated security reports

## Next Tasks

1. Test with actual Groq/OpenRouter API keys to verify end-to-end flow
2. Consider adding provider health checks on startup
3. Add UI components for security dashboard display
4. Implement WebSocket-level security event streaming
