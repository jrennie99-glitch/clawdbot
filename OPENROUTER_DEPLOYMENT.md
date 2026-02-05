# OpenRouter Top Open-Weight LLM Stack - Deployment Guide

## Overview
Moltbot/Clawdbot now uses **OpenRouter as the primary LLM provider** with the best open-source and open-weight models. **Claude is completely optional** and only used as a manual fallback.

---

## Key Changes

### 1. Primary Provider: OpenRouter
- **Default Provider**: OpenRouter (was: Groq)
- **Default Model**: DeepSeek R1 (best reasoning)
- **Fallback Chain**: DeepSeek R1 → Yi Lightning → Qwen 2.5 → Llama 3.3 → Mixtral → Llama 3.1
- **Claude**: Optional last-resort fallback only

### 2. New Presets
Four new presets available in `moltbot.json`:

#### `openrouter_top` (DEFAULT)
Best overall open models:
1. DeepSeek R1 (reasoning)
2. Yi Lightning (Kimi 2.5 - long context)
3. Qwen 2.5 72B (general intelligence)
4. Llama 3.3 70B (stable general)
5. Mixtral 8x22B (general)
6. Llama 3.1 8B (fast failsafe)

#### `openrouter_reasoning`
Best reasoning models:
- DeepSeek R1
- DeepSeek Chat V3
- Qwen 2.5 72B

#### `openrouter_long_context`
Large context windows:
- Yi Lightning (1M tokens!)
- Qwen 2.5 72B (131k)
- Llama 3.3 70B (131k)

#### `openrouter_fast`
Fastest models:
- Llama 3.1 8B
- Mistral 7B

### 3. Model Categories
Models organized by capability:
- **reasoning**: DeepSeek, Qwen
- **long_context**: Yi Lightning, Qwen
- **general**: Llama, Mixtral
- **fast**: Smaller Llama/Mistral

### 4. Hard Anti-Hang Safety
All enforced automatically:
- ✅ Connection timeout: 5s
- ✅ Request timeout: 12s
- ✅ First token timeout: 6s
- ✅ Max tokens: 700 (OpenRouter), 600-800 range
- ✅ Streaming: OFF by default
- ✅ Retry limit: 1 per model
- ✅ Abort on timeout: YES
- ✅ Failover on stall: YES

---

## Environment Variables

### Required (Minimum)
```bash
# OpenRouter API Key (PRIMARY - REQUIRED)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here

# App URL (for OAuth, etc.)
APP_URL=https://yourdomain.com

# Gateway Auth (for WebSocket)
GATEWAY_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret
```

### Optional Overrides
```bash
# OpenRouter base URL (default: https://openrouter.ai/api/v1)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Default provider (default: openrouter)
DEFAULT_LLM_PROVIDER=openrouter

# Default model (default: deepseek/deepseek-r1)
DEFAULT_MODEL=deepseek/deepseek-r1

# Timeouts
LLM_CONNECTION_TIMEOUT_MS=5000
LLM_REQUEST_TIMEOUT_MS=12000
LLM_FIRST_TOKEN_TIMEOUT_MS=6000

# Max tokens per provider
MAX_TOKENS_OPENROUTER=700
MAX_TOKENS_GROQ=512
MAX_TOKENS_OLLAMA=384

# Streaming (OFF by default)
LLM_STREAMING=false

# Max retries per model
LLM_MAX_RETRIES=1
```

### Legacy Providers (Optional)
```bash
# Groq (optional - for backwards compatibility)
GROQ_API_KEY=gsk_your_groq_key

# Ollama (optional - self-hosted)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3

# Claude (optional - premium fallback only)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

---

## Getting Started

### Step 1: Get OpenRouter API Key
1. Go to https://openrouter.ai/
2. Sign up / Log in
3. Go to Settings → API Keys
4. Create new key
5. Copy the key (starts with `sk-or-v1-`)

### Step 2: Set Environment Variables in Coolify
```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
APP_URL=https://yourdomain.com
GATEWAY_PASSWORD=$(openssl rand -base64 24)
SESSION_SECRET=$(openssl rand -base64 32)
```

### Step 3: Deploy
```bash
# Push code
git add .
git commit -m "feat: OpenRouter top open-weight LLM stack"
git push

# Deploy in Coolify UI
```

### Step 4: Verify
```bash
# Check health
curl https://yourdomain.com/healthz

# Test chat
# Should use DeepSeek R1 via OpenRouter
```

---

## Model Details

### Tier 1: Reasoning (Best for Complex Tasks)
| Model | Provider | Context | Tokens | Cost/M | Category |
|-------|----------|---------|--------|--------|----------|
| DeepSeek R1 | OpenRouter | 65k | 800 | $0.55/$2.19 | reasoning |
| DeepSeek Chat V3 | OpenRouter | 65k | 700 | $0.14/$0.28 | reasoning |
| Qwen 2.5 72B | OpenRouter | 131k | 700 | $0.35/$0.40 | reasoning |

### Tier 2: Long Context (Large Documents)
| Model | Provider | Context | Tokens | Cost/M | Category |
|-------|----------|---------|--------|--------|----------|
| Yi Lightning (Kimi 2.5) | OpenRouter | 1M | 700 | FREE | long_context |
| Qwen 2.5 72B | OpenRouter | 131k | 700 | $0.35/$0.40 | long_context |
| Llama 3.3 70B | OpenRouter | 131k | 700 | $0.35/$0.40 | general |

### Tier 3: General (Stable, Reliable)
| Model | Provider | Context | Tokens | Cost/M | Category |
|-------|----------|---------|--------|--------|----------|
| Llama 3.3 70B | OpenRouter | 131k | 700 | $0.35/$0.40 | general |
| Llama 3.1 70B | OpenRouter | 131k | 700 | $0.35/$0.40 | general |
| Mixtral 8x22B | OpenRouter | 65k | 700 | $0.65/$0.65 | general |
| Mixtral 8x7B | OpenRouter | 32k | 600 | $0.24/$0.24 | general |

### Tier 4: Fast (Quick Responses)
| Model | Provider | Context | Tokens | Cost/M | Category |
|-------|----------|---------|--------|--------|----------|
| Llama 3.1 8B | OpenRouter | 131k | 600 | $0.06/$0.06 | fast |
| Mistral 7B | OpenRouter | 32k | 600 | $0.06/$0.06 | fast |

---

## Failover Behavior

### Default Preset (`openrouter_top`)
```
Request → DeepSeek R1
  ↓ (if timeout/error)
  → Yi Lightning
  ↓ (if timeout/error)
  → Qwen 2.5 72B
  ↓ (if timeout/error)
  → Llama 3.3 70B
  ↓ (if timeout/error)
  → Mixtral 8x22B
  ↓ (if timeout/error)
  → Llama 3.1 8B (fast failsafe)
  ↓ (if timeout/error)
  → ERROR (all models failed)
```

### Failover Triggers
- Connection timeout (5s)
- Request timeout (12s)
- First token timeout (6s)
- HTTP error (4xx, 5xx)
- Network error

### Failover Speed
- Each model gets max 12s
- Total failover: ~6 models × 12s = ~72s worst case
- Typical: 1-2 attempts = 12-24s
- Best case: 1st model works = <3s

---

## Testing

### Test 1: Basic Chat (OpenRouter Works)
```bash
# In UI, send message
# Expected: Response from DeepSeek R1
# Check logs for: "Using provider: openrouter, model: deepseek/deepseek-r1"
```

### Test 2: Failover (Simulate Failure)
```bash
# Temporarily unset OPENROUTER_API_KEY
# Expected: Falls back to Groq or Ollama (if configured)
# Or shows error if no fallback available
```

### Test 3: Timeout Enforcement
```bash
# Send complex request
# Expected: Response in <12s or timeout
# Never hangs indefinitely
```

### Test 4: Max Tokens
```bash
# Ask for very long response
# Expected: Stops at ~700 tokens for OpenRouter
# Never infinite generation
```

---

## Migration from Groq-First Setup

### Old Setup (Groq Primary)
```json
{
  "agents": {
    "defaults": {
      "model": {
        "provider": "groq",
        "model": "llama-3.1-8b-instant"
      }
    }
  }
}
```

### New Setup (OpenRouter Primary)
```json
{
  "agents": {
    "defaults": {
      "preset": "openrouter_top"
    }
  }
}
```

### To Keep Groq Primary (Legacy)
Set in Coolify:
```bash
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.1-8b-instant
```

Or use preset in moltbot.json:
```json
{
  "agents": {
    "defaults": {
      "preset": "groq_primary"
    }
  }
}
```

---

## Troubleshooting

### Issue: "OpenRouter API key not configured"
**Fix**: Set `OPENROUTER_API_KEY` in Coolify env vars

### Issue: Still using Groq/Claude
**Check**: 
```bash
# Verify preset
cat /app/docker/moltbot.json | grep preset

# Should show: "preset": "openrouter_top"
```

**Fix**: Rebuild with `--no-cache` if old config cached

### Issue: Requests timeout
**Check**: OpenRouter API key valid and has credits
**Verify**: 
```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Issue: Models not found
**Check**: Model IDs match OpenRouter's catalog
**Verify**: https://openrouter.ai/models

### Issue: Slow responses
**Expected**: DeepSeek R1 may take 3-8s (reasoning model)
**Fast alternative**: Set `DEFAULT_MODEL=meta-llama/llama-3.1-8b-instruct`

---

## Cost Comparison

### OpenRouter Top Stack (per 1M tokens)
| Model | Input | Output | Total* |
|-------|-------|--------|--------|
| DeepSeek R1 | $0.55 | $2.19 | ~$1.37 |
| Yi Lightning | FREE | FREE | $0 |
| Qwen 2.5 72B | $0.35 | $0.40 | ~$0.38 |
| Llama 3.3 70B | $0.35 | $0.40 | ~$0.38 |
| Llama 3.1 8B | $0.06 | $0.06 | ~$0.06 |

*Assuming 50/50 input/output split

### Comparison
- **Yi Lightning**: FREE (1M context!)
- **OpenRouter Stack**: ~$0.38 average
- **Claude 3.5 Sonnet**: $3.00-$15.00
- **GPT-4**: $5.00-$30.00

**Savings**: 90-95% vs Claude/GPT-4

---

## Advanced Configuration

### Custom Preset
Add to `moltbot.json`:
```json
{
  "agents": {
    "presets": {
      "my_custom": {
        "name": "My Custom Preset",
        "provider": "openrouter",
        "model": "qwen/qwen-2.5-72b-instruct",
        "fallbacks": [
          { "provider": "openrouter", "model": "meta-llama/llama-3.3-70b-instruct" }
        ],
        "limits": {
          "maxTokens": 800,
          "temperature": 0.5
        }
      }
    }
  }
}
```

### Use Custom Preset
```bash
# In Coolify
DEFAULT_PRESET=my_custom
```

### Per-Agent Overrides
In code:
```typescript
const agent = await createAgent({
  preset: "openrouter_reasoning",  // Use reasoning preset
  model: {
    provider: "openrouter",
    model: "deepseek/deepseek-r1"
  }
});
```

---

## FAQ

### Q: Do I need Claude?
**A**: No! OpenRouter works fully without Claude. Claude is optional fallback only.

### Q: What if OpenRouter is down?
**A**: Falls back to Groq (if configured), then Ollama, then Claude (if configured).

### Q: Which model is fastest?
**A**: Llama 3.1 8B via OpenRouter (~1-2s responses)

### Q: Which model is smartest?
**A**: DeepSeek R1 (reasoning model) or Qwen 2.5 72B

### Q: Which model has longest context?
**A**: Yi Lightning (1M tokens!)

### Q: Can I use multiple presets?
**A**: Yes! Set default preset, then override per-agent as needed

### Q: How do I switch back to Groq?
**A**: Set `DEFAULT_LLM_PROVIDER=groq` or use `groq_primary` preset

---

## What Changed

### Code Changes
1. `/app/docker/moltbot.json` - Complete rewrite with OpenRouter models
2. `/app/src/agents/defaults.ts` - OpenRouter as primary, updated defaults
3. `/app/src/agents/llm-config.ts` - OpenRouter listed first

### Configuration Changes
- **Default provider**: Groq → OpenRouter
- **Default model**: llama-3.1-8b-instant → deepseek/deepseek-r1
- **Max tokens**: 512 → 700 for OpenRouter
- **Presets**: Added 4 new OpenRouter presets
- **Failover**: Updated chain to prioritize OpenRouter

### No Breaking Changes
- ✅ All existing env vars still work
- ✅ Groq still works (if configured)
- ✅ Claude still works (optional)
- ✅ Gateway unchanged
- ✅ Auth unchanged
- ✅ UI unchanged

---

## Summary

✅ **OpenRouter is now primary** (no Claude required)
✅ **11 open-weight models** available via OpenRouter
✅ **4 presets** for different use cases
✅ **Hard anti-hang safety** (5s/12s/6s timeouts)
✅ **Failover chain** (6 models deep)
✅ **90-95% cost savings** vs Claude/GPT-4
✅ **No breaking changes** (backwards compatible)

---

**Deploy now and enjoy fast, reliable, open-source LLMs!**
