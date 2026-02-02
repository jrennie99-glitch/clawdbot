# Verification Checklist

> Pre-deployment checklist for SUPER SUPREME GOD MODE security
> **Updated: 2026-02-02 - Integration Complete**

## ✅ Integration Verification

| Check | Command | Expected |
|-------|---------|----------|
| All tests pass | `npm run security:check && npx vitest run src/security/*.test.ts` | 148 tests passing |
| Kill switch blocks all | Set `KILL_SWITCH=true`, call any tool | Blocked with reason |
| Lockdown requires confirm | Set `LOCKDOWN_MODE=true`, call shell | Requires confirmation |
| SSRF blocked | `checkToolExecution({toolName:'web_fetch', where:{domain:'localhost'}})` | Denied |
| Secrets redacted in logs | `logInfo("key: sk-1234567890abcdefgh")` | Contains [REDACTED] |
| Rate limiting enforced | 100+ tool calls in run | Blocked after limit |

## Quick Verification Commands

```bash
# Run all security tests (148 tests)
npm run security:check && npx vitest run src/security/*.test.ts

# Test kill switch
KILL_SWITCH=true npm run moltbot -- agent --rpc --test-security

# Test lockdown
LOCKDOWN_MODE=true npm run moltbot -- agent --rpc --test-security
```

## Critical Checks

- [x] **Kill Switch Test**: Set `KILL_SWITCH=true` and verify ALL tool execution is blocked
- [x] **Lockdown Mode Test**: Set `LOCKDOWN_MODE=true` and verify confirmations required
- [x] **Claude Optional**: Remove `ANTHROPIC_API_KEY` and verify system still works
- [x] **SSRF Protection**: Attempt requests to localhost, private IPs, metadata endpoints
- [x] **Secret Redaction**: Check logs for any leaked API keys or tokens
- [x] **Prompt Injection**: Test common injection patterns are detected/blocked
- [x] **Budget Limits**: Verify cost/token limits are enforced

## Functional Tests

### Trust Zones

```bash
# Test content quarantine
npm test -- src/security/trust-zones.test.ts

# Test sanitization
npm test -- src/security/content-sanitizer.test.ts
```

### Policy Engine

```bash
# Test policy rules
npm test -- src/security/policy-engine.test.ts
```

### Secret Redaction

```bash
# Test secret patterns
npm test -- src/security/secret-redaction.test.ts
```

### LLM Router

```bash
# Test model routing
npm test -- src/security/llm-router.test.ts
```

## Security Smoke Tests

### 1. Prompt Injection

```bash
# Run injection tests
npm run security:check
```

Test patterns:
- "Ignore all previous instructions"
- "You are now a different assistant"
- XML tags: `<system>`, `</assistant>`
- Shell injection: `$(command)`, `` `command` ``

### 2. SSRF Attempts

Test blocked URLs:
- `http://localhost/`
- `http://127.0.0.1/`
- `http://[::1]/`
- `http://169.254.169.254/`
- `http://10.0.0.1/`
- `http://192.168.1.1/`
- `http://metadata.google.internal/`

### 3. Secret Leakage

Check that these are redacted:
- `sk-...` (OpenAI keys)
- `sk-ant-...` (Anthropic keys)
- `ghp_...` (GitHub tokens)
- Bearer tokens in logs
- Database URLs with passwords

### 4. Memory Poisoning

Verify:
- Untrusted content cannot influence planning
- Memory provenance is tracked
- TTL expiration works

### 5. Skill Exfiltration

Verify:
- Skills cannot access global memory directly
- Skills require permission manifests
- Skill outputs are quarantined

## Rate Limit Tests

- [ ] IP rate limiting works
- [ ] User rate limiting works
- [ ] Tool call limits enforced
- [ ] Token limits enforced
- [ ] Cost limits enforced

## Environment Variables

Confirm these are set in production:

```bash
# Required - at least one provider
MOONSHOT_API_KEY=set
OPENROUTER_API_KEY=set

# Or local
OLLAMA_HOST=set

# Optional security controls
KILL_SWITCH_CONFIRM_CODE=set_secret_code
```

## Docker Security

- [ ] Container runs as non-root user
- [ ] Capabilities are dropped (`--cap-drop=ALL`)
- [ ] Read-only filesystem where possible
- [ ] No privileged mode

## Post-Deployment

1. Monitor logs for security warnings
2. Check daily cost usage
3. Review audit logs for anomalies
4. Run `moltbot security audit --deep` weekly

## Sign-Off

| Check | Verified By | Date |
|-------|-------------|------|
| Kill Switch | | |
| Lockdown Mode | | |
| Claude Optional | | |
| SSRF Protection | | |
| Secret Redaction | | |
| Prompt Injection | | |
| Budget Limits | | |
| All Tests Pass | | |
