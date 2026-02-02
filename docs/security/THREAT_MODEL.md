# Moltbot/OpenClaw Threat Model

> Generated: 2026-02-02 | Security Audit: SUPER SUPREME GOD MODE

## Executive Summary

This document provides a comprehensive security threat model for the Moltbot/OpenClaw codebase,
identifying attack surfaces, trust boundaries, and security controls.

---

## 1. System Architecture Overview

### 1.1 Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UNTRUSTED ZONE (ZONE A)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   WhatsApp   │  │   Telegram   │  │   Discord    │  │    Slack     │    │
│  │     DMs      │  │     DMs      │  │     DMs      │  │     DMs      │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
│  ┌──────┴─────────────────┴─────────────────┴─────────────────┴──────┐     │
│  │                    INGESTION QUARANTINE                            │     │
│  │  - Raw content storage                                             │     │
│  │  - Content sanitization                                            │     │
│  │  - PII/secret redaction                                            │     │
│  └────────────────────────────┬───────────────────────────────────────┘     │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REASONING ZONE (ZONE B)                            │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                      CONTEXT FIREWALL                               │     │
│  │  - Secrets redacted before LLM                                      │     │
│  │  - Only sanitized summaries passed                                  │     │
│  │  - Explicit user commands only                                      │     │
│  └────────────────────────────┬───────────────────────────────────────┘     │
│                               │                                             │
│  ┌────────────────────────────┴───────────────────────────────────────┐     │
│  │                         LLM ROUTER                                  │     │
│  │  Kimi K2.5 │ OpenRouter │ Local (Ollama/vLLM) │ Claude (OPTIONAL)  │     │
│  └────────────────────────────┬───────────────────────────────────────┘     │
└───────────────────────────────┼─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION ZONE (ZONE C)                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     POLICY ENGINE                                   │     │
│  │  WHO │ WHAT │ WHERE │ RISK │ BUDGET                                 │     │
│  │  ────────────────────────────────────                               │     │
│  │  ALLOW │ REQUIRE_CONFIRMATION │ DENY                                │     │
│  └────────────────────────────────┬───────────────────────────────────┘     │
│                                   │                                         │
│  ┌────────────┐  ┌────────────┐  ┌┴───────────┐  ┌────────────┐            │
│  │   Shell    │  │  Browser   │  │ Filesystem │  │  Network   │            │
│  │  (Sandbox) │  │  (Sandbox) │  │  (Scoped)  │  │ (Allowlist)│            │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Attack Surface Inventory

### 2.1 Entrypoints

| Entrypoint | Location | Risk Level | Trust Level |
|------------|----------|------------|-------------|
| WhatsApp DMs | `/src/whatsapp/` | CRITICAL | Untrusted |
| Telegram DMs | `/extensions/telegram/` | CRITICAL | Untrusted |
| Discord DMs | `/extensions/discord/` | CRITICAL | Untrusted |
| Slack Messages | `/extensions/slack/` | CRITICAL | Untrusted |
| LINE Bot | `/src/line/` | CRITICAL | Untrusted |
| Signal | `/extensions/signal/` | CRITICAL | Untrusted |
| iMessage | `/extensions/imessage/` | HIGH | Semi-trusted |
| Gateway WebSocket | `/src/gateway/server.ts` | HIGH | Authenticated |
| Gateway HTTP API | `/src/gateway/server-http.ts` | HIGH | Authenticated |
| Webhook Endpoints | `/src/hooks/` | CRITICAL | Untrusted |
| Gmail Hooks | `/src/hooks/gmail.ts` | CRITICAL | Untrusted |
| Control UI | `/src/gateway/control-ui.ts` | HIGH | Authenticated |
| TUI Interface | `/src/tui/` | LOW | Local |
| CLI Commands | `/src/commands/` | LOW | Local |
| Plugin HTTP | `/src/plugins/http-registry.ts` | MEDIUM | Plugin-scoped |
| Cron Jobs | `/src/cron/` | MEDIUM | System |
| Browser Extension | `/assets/chrome-extension/` | MEDIUM | Extension |

### 2.2 Authentication & Sessions

| Component | Location | Risk |
|-----------|----------|------|
| Gateway Auth | `/src/gateway/auth.ts` | Token/Password auth |
| Device Auth | `/src/gateway/device-auth.ts` | Device identity |
| OAuth Profiles | `/src/agents/auth-profiles/` | Multi-provider OAuth |
| Session Management | `/src/sessions/` | Session keys |
| Pairing System | `/src/pairing/` | User pairing |
| JWT/Tokens | `/src/agents/cli-credentials.ts` | API credentials |

### 2.3 Database Access

| Component | Location | Risk |
|-----------|----------|------|
| SQLite Memory | `/src/memory/sqlite.ts` | Vector DB |
| Session Store | `/src/config/sessions/store.ts` | Session persistence |
| Config IO | `/src/config/io.ts` | JSON5 config |
| Auth Profiles Store | `/src/agents/auth-profiles/store.ts` | Credentials |
| LanceDB | `/extensions/memory-lancedb/` | Vector search |

### 2.4 File I/O Operations

| Component | Location | Risk |
|-----------|----------|------|
| Read/Write Tools | `/src/agents/pi-tools.read.ts` | File access |
| Patch Application | `/src/agents/apply-patch.ts` | Code modification |
| Bootstrap Files | `/src/agents/bootstrap-files.ts` | Context loading |
| Downloads | `/src/browser/pw-tools-core.downloads.ts` | File downloads |
| Media Processing | `/src/media/` | Image/audio handling |
| Skill Files | `/src/agents/skills/` | Skill loading |

### 2.5 Tool Execution (CRITICAL)

| Tool | Location | Risk Level | Requires Confirmation |
|------|----------|------------|----------------------|
| Bash/Exec | `/src/agents/bash-tools.exec.ts` | CRITICAL | YES |
| Process Management | `/src/agents/bash-tools.process.ts` | CRITICAL | YES |
| Browser Automation | `/src/agents/tools/browser-tool.ts` | HIGH | YES |
| Web Fetch | `/src/agents/tools/web-fetch.ts` | HIGH | SSRF check |
| Image Generation | `/src/agents/tools/image-tool.ts` | MEDIUM | NO |
| Message Sending | `/src/agents/tools/message-tool.ts` | HIGH | YES (external) |
| Memory Operations | `/src/agents/tools/memory-tool.ts` | MEDIUM | NO |
| Cron Scheduling | `/src/agents/tools/cron-tool.ts` | HIGH | YES |
| Gateway Operations | `/src/agents/tools/gateway-tool.ts` | HIGH | YES |
| Canvas Actions | `/src/agents/tools/canvas-tool.ts` | LOW | NO |

### 2.6 Skills/Plugins Architecture

| Component | Location | Risk |
|-----------|----------|------|
| Skill Discovery | `/src/agents/skills/` | Dynamic loading |
| Plugin Loader | `/src/plugins/loader.ts` | Code execution |
| Plugin Runtime | `/src/plugins/runtime.ts` | Sandboxed execution |
| Hook System | `/src/hooks/` | Event handlers |
| Plugin HTTP | `/src/plugins/http-registry.ts` | Custom endpoints |

### 2.7 LLM Integration

| Provider | Location | Risk |
|----------|----------|------|
| Anthropic/Claude | `/src/agents/pi-embedded-*` | OPTIONAL |
| OpenAI | `/src/agents/pi-embedded-helpers/openai.ts` | Supported |
| Google/Gemini | `/src/agents/pi-embedded-helpers/google.ts` | Supported |
| Moonshot/Kimi | `/scripts/sync-moonshot-docs.ts` | Primary |
| OpenRouter | Multiple | Supported |
| Ollama | `/src/agents/models-config.providers.ollama.test.ts` | Local |
| Bedrock | `/src/agents/bedrock-discovery.ts` | AWS |

### 2.8 Logging & Telemetry

| Component | Location | Risk |
|-----------|----------|------|
| Logger | `/src/logger.ts` | Secret exposure |
| Config Logging | `/src/config/logging.ts` | Redaction needed |
| Anthropic Payload Log | `/src/agents/anthropic-payload-log.ts` | Sensitive data |
| WebSocket Logging | `/src/gateway/ws-log.ts` | Message logging |

---

## 3. Trust Boundaries

### 3.1 Zone A: Untrusted Ingestion

**Sources:**
- All DM channels (WhatsApp, Telegram, Discord, Slack, LINE, Signal, iMessage)
- Webhook payloads
- Gmail/email content
- Web page content (fetched URLs)
- Uploaded documents
- Skill outputs from untrusted sources

**Security Controls:**
- Content quarantine before processing
- HTML/JS stripping
- Hidden instruction detection
- Secret/PII redaction
- Length limiting
- Character encoding validation

### 3.2 Zone B: Reasoning (LLM)

**Allowed Inputs:**
- Sanitized content summaries
- Explicit user commands from paired users
- Tool schemas (secrets REDACTED)
- System prompts (hardened)

**Prohibited:**
- Raw external content
- API keys, tokens, passwords
- Session cookies
- OAuth tokens
- Private keys

### 3.3 Zone C: Execution (Tools)

**All tool calls MUST pass through Policy Engine.**

**Execution Modes:**
- ALLOW: Safe, read-only, local operations
- REQUIRE_CONFIRMATION: Destructive, external, privileged operations
- DENY: Always blocked operations

---

## 4. Threat Categories

### 4.1 Prompt Injection (CRITICAL)

| Vector | Mitigation |
|--------|------------|
| Direct injection via DM | Content sanitization, boundary markers |
| Indirect via web pages | External content wrapping |
| Indirect via documents | Document content isolation |
| Indirect via skill output | Skill output quarantine |
| Memory poisoning | Memory provenance tracking |

### 4.2 Data Exfiltration (CRITICAL)

| Vector | Mitigation |
|--------|------------|
| Secret in logs | Secret redaction middleware |
| Secret in LLM prompts | Context firewall |
| Bulk data export | Rate limiting, confirmation |
| External sends | Policy engine approval |

### 4.3 SSRF (HIGH)

| Vector | Mitigation |
|--------|------------|
| Localhost access | Hostname blocklist |
| Private IP ranges | DNS resolution check |
| Cloud metadata | 169.254.169.254 blocked |
| Redirect attacks | Redirect target validation |

### 4.4 Privilege Escalation (HIGH)

| Vector | Mitigation |
|--------|------------|
| Elevated exec abuse | Strict allowlist |
| Config modification | Policy engine |
| Tool policy bypass | Centralized enforcement |

### 4.5 Supply Chain (MEDIUM)

| Vector | Mitigation |
|--------|------------|
| Malicious skills | Skill sandbox |
| Plugin vulnerabilities | Permission manifest |
| Dependency attacks | Integrity checks |

---

## 5. Security Controls Matrix

| Control | Status | Location |
|---------|--------|----------|
| Content Sanitization | ✅ Enhanced | `/src/security/content-sanitizer.ts` |
| Policy Engine | ✅ NEW | `/src/security/policy-engine.ts` |
| Trust Zones | ✅ NEW | `/src/security/trust-zones.ts` |
| Memory Provenance | ✅ NEW | `/src/security/memory-provenance.ts` |
| Secret Redaction | ✅ Enhanced | `/src/security/secret-redaction.ts` |
| SSRF Protection | ✅ Existing | `/src/agents/tools/web-fetch.ts` |
| Tool Policy | ✅ Enhanced | `/src/agents/tool-policy.ts` |
| LLM Router | ✅ NEW | `/src/security/llm-router.ts` |
| Cost Controls | ✅ NEW | `/src/security/cost-controls.ts` |
| Kill Switch | ✅ NEW | `/src/security/kill-switch.ts` |
| Lockdown Mode | ✅ NEW | `/src/security/lockdown-mode.ts` |
| Action Preview | ✅ NEW | `/src/security/action-preview.ts` |

---

## 6. Environment Variables

### Security Controls

| Variable | Purpose | Default |
|----------|---------|---------||
| `LOCKDOWN_MODE` | Enable strict security mode | `false` |
| `KILL_SWITCH` | Disable all tool execution | `false` |
| `SECRET_REDACTION` | Enable secret redaction | `true` |
| `TRUST_ZONE_STRICT` | Enforce zone boundaries | `true` |
| `POLICY_ENGINE_ENABLED` | Enable policy engine | `true` |

### LLM Providers (OPTIONAL)

| Variable | Purpose | Required |
|----------|---------|----------|
| `MOONSHOT_API_KEY` | Kimi K2.5 access | Optional |
| `OPENROUTER_API_KEY` | OpenRouter access | Optional |
| `OLLAMA_HOST` | Local Ollama | Optional |
| `ANTHROPIC_API_KEY` | Claude (OPTIONAL) | NO |
| `OPENAI_API_KEY` | OpenAI models | Optional |
| `GOOGLE_API_KEY` | Gemini models | Optional |

---

## 7. Compliance Checklist

- [ ] No untrusted input causes tool execution without approval
- [ ] No secrets appear in logs, prompts, or responses
- [ ] System runs securely WITHOUT Claude
- [ ] All existing features still work
- [ ] Lockdown Mode verified
- [ ] Kill Switch verified
- [ ] SSRF protection verified
- [ ] Prompt injection tests pass
- [ ] Memory poisoning tests pass
- [ ] Secret leakage tests pass

---

## 8. References

- `/docs/security/SECURITY_AUDIT.md` - Audit report
- `/docs/security/SECURITY_DEFAULTS.md` - Default configurations
- `/docs/security/COST_OPTIMIZATION.md` - Cost controls
- `/docs/security/VERIFICATION_CHECKLIST.md` - Testing checklist
