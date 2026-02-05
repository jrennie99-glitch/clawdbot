# Deploy MoltBot on Coolify

This guide covers deploying MoltBot to Coolify with **cheap, fast LLM providers** (Groq/OpenRouter) instead of expensive Claude.

## Quick Start

### 1. Required Environment Variables

```env
# Authentication (REQUIRED - generate random string)
GATEWAY_TOKEN=your-secure-random-token

# LLM Config (CRITICAL for performance)
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.1-8b-instant
LLM_STREAMING=false
LLM_REQUEST_TIMEOUT_MS=15000
LLM_MAX_RETRIES=1
```

### 2. Choose Your Provider

#### Option A: Groq (Recommended - Free tier available)

Fast inference, free tier with rate limits.

```env
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.1-8b-instant
GROQ_API_KEY=gsk_your_groq_api_key

# OR use OpenAI-compatible endpoint:
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_your_groq_api_key
```

**Available Groq Models:**
| Model | Speed | Quality | Context |
|-------|-------|---------|---------|
| `llama-3.1-8b-instant` | ⚡ Fastest | Good | 128K |
| `llama-3.3-70b-versatile` | Fast | Excellent | 128K |
| `mixtral-8x7b-32768` | Fast | Very Good | 32K |
| `deepseek-r1-distill-llama-70b` | Medium | Excellent (reasoning) | 128K |

Get your free API key: https://console.groq.com/keys

---

#### Option B: OpenRouter (Many models, pay-per-use)

Access to 100+ models from various providers.

```env
DEFAULT_LLM_PROVIDER=openrouter
DEFAULT_MODEL=meta-llama/llama-3.1-8b-instruct
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key

# OR use OpenAI-compatible endpoint:
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-v1-your_openrouter_key
```

**Recommended OpenRouter Models:**
| Model | Cost | Quality |
|-------|------|---------|
| `meta-llama/llama-3.1-8b-instruct` | $0.06/M | Good |
| `deepseek/deepseek-chat` | $0.14/M | Very Good |
| `qwen/qwen-2.5-72b-instruct` | $0.35/M | Excellent |
| `mistralai/mixtral-8x7b-instruct` | $0.24/M | Very Good |

Get your API key: https://openrouter.ai/keys

---

#### Option C: Ollama (Local, free)

Run models locally. Requires Ollama server running separately.

```env
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_MODEL=llama3
OLLAMA_BASE_URL=http://your-ollama-server:11434/v1
OLLAMA_MODEL=llama3
```

**Note:** Ollama must be accessible from your Coolify container. Use internal Docker network or expose Ollama publicly.

---

## Full Environment Variables Reference

### LLM Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_LLM_PROVIDER` | `groq` | Primary LLM provider |
| `DEFAULT_MODEL` | `llama-3.1-8b-instant` | Model to use |
| `LLM_STREAMING` | `false` | Streaming mode (keep false for reliability) |
| `LLM_REQUEST_TIMEOUT_MS` | `15000` | Request timeout (15s) |
| `LLM_MAX_RETRIES` | `1` | Retry count on failure |

### API Keys

| Variable | Provider | Get Key |
|----------|----------|---------|
| `GROQ_API_KEY` | Groq | https://console.groq.com/keys |
| `OPENROUTER_API_KEY` | OpenRouter | https://openrouter.ai/keys |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | https://console.anthropic.com |
| `GOOGLE_API_KEY` | Google (Gemini) | https://makersuite.google.com/app/apikey |
| `MOONSHOT_API_KEY` | Moonshot/Kimi | https://platform.moonshot.cn |

### OpenAI-Compatible Override

| Variable | Description |
|----------|-------------|
| `OPENAI_BASE_URL` | Custom base URL for OpenAI-compatible APIs |
| `OPENAI_API_KEY` | API key for the custom endpoint |

### Local LLM (Ollama)

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama server URL (include `/v1` suffix) |
| `OLLAMA_MODEL` | Model name (must be pulled first) |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_TOKEN` | (required) | Authentication token |
| `PORT` | `3000` | HTTP server port |
| `GATEWAY_PORT` | `8001` | Internal gateway port |

---

## Provider Failover

MoltBot supports automatic failover when a provider fails. Configure in `moltbot.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "provider": "groq",
        "model": "llama-3.1-8b-instant",
        "fallbacks": [
          { "provider": "openrouter", "model": "meta-llama/llama-3.1-8b-instruct" },
          { "provider": "ollama", "model": "llama3" },
          { "provider": "anthropic", "model": "claude-3-haiku-20240307" }
        ]
      }
    }
  }
}
```

Failover triggers on:
- Request timeout (stuck requests)
- Rate limiting (429)
- Auth errors (401)
- Server errors (5xx)

---

## Troubleshooting

### "Stuck writing" / infinite spinner

**Cause:** Streaming enabled with incompatible provider.

**Fix:**
```env
LLM_STREAMING=false
```

### "Missing API key" error

**Cause:** Provider selected but no API key configured.

**Fix:** Add the corresponding API key for your provider.

### "Request timed out"

**Cause:** Model too slow or network issues.

**Fix:**
1. Try a faster model (e.g., `llama-3.1-8b-instant`)
2. Increase timeout: `LLM_REQUEST_TIMEOUT_MS=30000`
3. Check provider status at https://status.groq.com or OpenRouter status

### "Model not found"

**Cause:** Invalid model ID for the provider.

**Fix:** Check the model ID matches exactly. Model IDs are case-sensitive.

### Ollama not connecting

**Cause:** Ollama server unreachable from container.

**Fix:**
1. Ensure Ollama is running: `ollama serve`
2. Use correct URL with `/v1` suffix
3. If in Docker, use host network or internal DNS

---

## Testing Provider Configuration

Use the built-in provider test endpoint:

```bash
# Check provider status
curl -X POST http://localhost:8001/api/providers.status \
  -H "Authorization: Bearer $GATEWAY_TOKEN"

# Test all configured providers
curl -X POST http://localhost:8001/api/providers.test \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
```

Response includes:
- Provider configuration status
- Test results (success/fail)
- Latency measurements
- Error messages

---

## Recommended Presets

### Budget Setup (Free/Cheap)
```env
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.1-8b-instant
GROQ_API_KEY=your_key
LLM_STREAMING=false
```

### Quality Setup (Better responses)
```env
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=your_key
LLM_STREAMING=false
```

### Local Privacy Setup
```env
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_MODEL=llama3
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3
LLM_STREAMING=false
LLM_REQUEST_TIMEOUT_MS=30000
```

---

## Security Configuration

MoltBot includes a built-in cybersecurity defense system with rate limiting, firewall, and lockdown modes.

### Basic Security Setup

```env
# Enable firewall (default: true)
SECURITY_FIREWALL=true

# Rate limits
RATE_LIMIT_API_PER_MINUTE=60
RATE_LIMIT_LOGIN_PER_HOUR=5
RATE_LIMIT_WS_PER_IP=3

# Auto-block abusive IPs for 30 minutes
AUTO_BLOCK_DURATION_MS=1800000
MAX_FAILED_AUTH_ATTEMPTS=5
```

### Gateway Protection

For additional gateway security:

```env
# Require password + token for WebSocket connections
GATEWAY_PASSWORD_REQUIRED=true
GATEWAY_PASSWORD=your-secure-password

# Limit total connections
GATEWAY_MAX_CONNECTIONS=100
```

### Lockdown Mode

Enable lockdown when under attack or for maintenance:

```env
# Admin-only access
SECURITY_LOCKDOWN=true
SECURITY_ADMIN_EMAIL=admin@example.com
SECURITY_ADMIN_ONLY=true

# Disable specific features
SECURITY_CHAT_DISABLED=true
SECURITY_TOOLS_DISABLED=true
```

### Emergency Mode

For immediate complete lockdown:

```env
SECURITY_EMERGENCY=true
```

This disables all features except admin access.

### Kill Switch

Immediately disable all tool execution:

```env
KILL_SWITCH=true
```

To deactivate, you need the confirmation code:
```env
KILL_SWITCH_CONFIRM_CODE=your-secret-code
```

### Security Dashboard

Access the security dashboard via gateway methods:

```bash
# Get security overview
curl -X POST http://localhost:8001/api/security.dashboard \
  -H "Authorization: Bearer $GATEWAY_TOKEN"

# View blocked IPs
curl -X POST http://localhost:8001/api/security.blocked.list \
  -H "Authorization: Bearer $GATEWAY_TOKEN"

# View security incidents
curl -X POST http://localhost:8001/api/security.incidents.list \
  -H "Authorization: Bearer $GATEWAY_TOKEN"

# Toggle lockdown mode
curl -X POST http://localhost:8001/api/security.lockdown.toggle \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true, "reason": "Maintenance"}'
```

### Security Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SECURITY_FIREWALL` | `true` | Enable request firewall |
| `SECURITY_STRICT_MODE` | `false` | Enable strict header validation |
| `RATE_LIMIT_API_PER_MINUTE` | `60` | API rate limit per IP |
| `RATE_LIMIT_LOGIN_PER_HOUR` | `5` | Login attempts per IP |
| `RATE_LIMIT_WS_PER_IP` | `3` | WebSocket connections per IP |
| `AUTO_BLOCK_DURATION_MS` | `1800000` | IP block duration (30 min) |
| `MAX_FAILED_AUTH_ATTEMPTS` | `5` | Attempts before auto-block |
| `GATEWAY_PASSWORD_REQUIRED` | `false` | Require password for gateway |
| `GATEWAY_PASSWORD` | - | Gateway password |
| `GATEWAY_MAX_CONNECTIONS` | `1000` | Max gateway connections |
| `SECURITY_LOCKDOWN` | `false` | Enable lockdown mode |
| `SECURITY_ADMIN_EMAIL` | - | Admin email for lockdown |
| `SECURITY_EMERGENCY` | `false` | Emergency mode |
| `KILL_SWITCH` | `false` | Disable all tools |
