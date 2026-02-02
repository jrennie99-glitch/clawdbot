# Security Defaults

> Default security configuration for SUPER SUPREME GOD MODE

## Environment Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `KILL_SWITCH` | `false` | Emergency tool execution disable |
| `LOCKDOWN_MODE` | `false` | Strict confirmation mode |
| `DAILY_COST_LIMIT_USD` | `10` | Maximum daily LLM spend |
| `PER_RUN_COST_LIMIT_USD` | `1` | Maximum spend per run |
| `TOKENS_PER_RUN_LIMIT` | `100000` | Maximum tokens per run |
| `TOOL_CALLS_PER_RUN_LIMIT` | `100` | Maximum tool calls per run |

## Trust Levels

| Source | Trust Level | Can Influence Planning | Can Execute Tools |
|--------|-------------|----------------------|------------------|
| `owner` | HIGH | Yes | Yes |
| `system` | HIGH | Yes | Yes |
| `paired` | MEDIUM | Yes | Yes (with limits) |
| `unpaired` | LOW | No | No |
| `skill` | LOW | No | No |
| `web` | UNTRUSTED | No | No |
| `document` | UNTRUSTED | No | No |
| `email` | UNTRUSTED | No | No |
| `webhook` | UNTRUSTED | No | No |
| `api` | UNTRUSTED | No | No |

## Default Lockdown Allowlist

When `LOCKDOWN_MODE=true`, only these domains are allowed:

```
api.anthropic.com
api.openai.com
api.moonshot.cn
openrouter.ai
generativelanguage.googleapis.com
github.com
raw.githubusercontent.com
```

Add custom domains via `LOCKDOWN_NETWORK_ALLOWLIST`.

## Policy Decision Priority

1. **Kill Switch** (10000) - Blocks everything
2. **Always Deny** (9000) - Secrets, SSRF, exfiltration
3. **Lockdown Rules** (8000) - When lockdown enabled
4. **Budget Limits** (8500) - Cost/token limits
5. **Confirmation Required** (5000) - Destructive/external actions
6. **Allow** (1000) - Safe read operations

## Model Routing Defaults

| Task Type | Preferred Tier |
|-----------|---------------|
| Planning | SMART |
| Tool summaries | FAST |
| Simple tasks | CHEAP |
| Long documents | LONG_CONTEXT |
| Code generation | SMART, FAST |
| General | FAST, SMART |

## Fallback Chain

```
SMART → FAST → CHEAP → FAIL_SAFE
FAST → CHEAP → SMART → FAIL_SAFE  
CHEAP → FAST → FAIL_SAFE
LONG_CONTEXT → SMART → FAST → FAIL_SAFE
```

## Content Sanitization Defaults

| Option | Default |
|--------|--------|
| Strip HTML | `true` |
| Strip hidden instructions | `true` |
| Redact secrets | `true` |
| Max length | `100000` chars |

## Memory Provenance

- Default TTL: None (no expiration)
- Cleanup interval: 1 hour
- Quarantine max age: 1 hour
