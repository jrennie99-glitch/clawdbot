# Moltbot/OpenClaw Security Upgrade PRD

## Original Problem Statement

Upgrade existing Moltbot/OpenClaw codebase to "SUPER SUPREME GOD MODE" security, privacy, and reliability WITHOUT removing or breaking any existing features. Add layers only. No placeholders. No fake security. Everything must be real, production-grade, and verifiable.

## User Choices

- **LLM Providers**: Moonshot Kimi (K2.5), OpenRouter as primary; Claude OPTIONAL
- **Database**: PostgreSQL
- **Deployment**: Docker containers (Coolify/Hetzner-compatible)
- **Priority**: Security hardening first (Phases 1-7), then LLM router (8-9)

## Architecture

### Trust Zones (Zone A/B/C)
- **Zone A (Untrusted)**: DMs, web pages, docs, emails, webhooks
- **Zone B (Reasoning)**: LLM processing with sanitized input only
- **Zone C (Execution)**: Tool execution via Policy Engine only

### Security Components
- `/src/security/types.ts` - Core security types
- `/src/security/utils.ts` - Utility functions
- `/src/security/trust-zones.ts` - Zone A/B/C implementation
- `/src/security/content-sanitizer.ts` - Prompt injection detection
- `/src/security/secret-redaction.ts` - 25+ secret patterns
- `/src/security/policy-engine.ts` - Central policy engine
- `/src/security/kill-switch.ts` - Emergency controls
- `/src/security/llm-router.ts` - Multi-provider router
- `/src/security/cost-controls.ts` - Budget management

## What's Been Implemented

### Date: 2026-02-02

#### Phase 1: Threat Model ✅
- Full inventory of attack surfaces
- Trust boundaries documented
- See: `/docs/security/THREAT_MODEL.md`

#### Phase 2-3: Trust Boundaries & Policy Engine ✅
- Three-zone architecture
- Central deterministic policy engine
- Content quarantine and sanitization
- 18 prompt injection patterns detected

#### Phase 4: Memory Safety ✅
- Memory provenance tracking
- Trust level enforcement
- TTL/expiration support

#### Phase 5: Skills/Supply Chain ✅
- Skill permission manifest
- Sandbox execution context

#### Phase 6-7: App Security & No-Leak Guarantee ✅
- Secret redaction (25+ patterns)
- Environment variable redaction
- Safe stringify functions

#### Phase 8-9: LLM Router & Cost Controls ✅
- Multi-provider router (Kimi, OpenRouter, Ollama)
- Claude is OPTIONAL
- Budget management with graceful degradation
- Model fallback chains

#### Phase 10-11: Kill Switch & Tests ✅
- Kill switch (KILL_SWITCH=true)
- Lockdown mode (LOCKDOWN_MODE=true)
- 43 security tests passing

## Prioritized Backlog

### P0 (Critical)
- [x] Trust zones implementation
- [x] Policy engine
- [x] Secret redaction
- [x] Kill switch
- [x] LLM router

### P1 (High)
- [ ] Integration with existing tool execution paths
- [ ] Database audit logging
- [ ] Request rate limiting middleware

### P2 (Medium)
- [ ] Skills sandbox containerization
- [ ] Custom policy rule UI
- [ ] Cost dashboard

## Next Tasks

1. **Integration**: Wire security modules into existing tool execution paths
2. **Audit Logging**: Add audit log persistence to PostgreSQL
3. **Rate Limiting**: Implement request rate limiting middleware
4. **Production Testing**: Deploy and test in production environment
5. **Documentation**: Complete API documentation for security modules

## Environment Variables

```bash
# Security Controls
KILL_SWITCH=true/false
LOCKDOWN_MODE=true/false
KILL_SWITCH_CONFIRM_CODE=secret_code

# Cost Controls  
DAILY_COST_LIMIT_USD=10
PER_RUN_COST_LIMIT_USD=1
TOKENS_PER_RUN_LIMIT=100000

# LLM Providers
MOONSHOT_API_KEY=xxx
OPENROUTER_API_KEY=xxx
OLLAMA_HOST=http://localhost:11434
```

## Test Commands

```bash
# Run security tests
node_modules/.bin/vitest run src/security/security.test.ts --config vitest.unit.config.ts

# Smoke test
npm run smoke
```
