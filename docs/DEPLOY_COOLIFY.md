# MoltBot Coolify Deployment Guide

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GATEWAY_TOKEN` | **YES** | Authentication token for gateway. Generate a secure random string (32+ chars). Both backend and frontend must use the same value. |
| `PORT` | No | Server port. Default: 3000. Coolify usually sets this automatically. |

## Optional Environment Variables (LLM Providers)

| Variable | Provider | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | API key from https://platform.openai.com |
| `ANTHROPIC_API_KEY` | Anthropic | API key from https://console.anthropic.com |
| `GOOGLE_API_KEY` | Google AI | API key from https://makersuite.google.com |
| `MOONSHOT_API_KEY` | Moonshot/Kimi | API key from https://platform.moonshot.cn |
| `KIMI_API_KEY` | Moonshot/Kimi | Alternative name for Moonshot key |
| `OPENROUTER_API_KEY` | OpenRouter | API key from https://openrouter.ai |
| `OLLAMA_BASE_URL` | Ollama (local) | URL to Ollama server, e.g., `http://localhost:11434` |

## Coolify Configuration

### Build Settings
| Setting | Value |
|---------|-------|
| Build Type | Dockerfile |
| Dockerfile Location | `/Dockerfile` |
| Build Context | `/` |

### Network Settings
| Setting | Value |
|---------|-------|
| Exposed Port | `3000` |
| Health Check Path | `/health` |
| Health Check Interval | `30s` |

### Required Environment Variables in Coolify
```
GATEWAY_TOKEN=your-secure-random-token-here
```

### Optional LLM Provider Keys
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MOONSHOT_API_KEY=...
OPENROUTER_API_KEY=...
```

## Quick Start

1. **Create new service in Coolify**
   - Select "Docker" as build type
   - Point to your repository

2. **Set environment variables**
   - Go to Environment Variables tab
   - Add `GATEWAY_TOKEN` with a secure random value
   - Add any LLM provider API keys you want to use

3. **Deploy**
   - Click Deploy
   - Wait for build to complete

4. **Verify**
   - Open your app URL
   - You should see "Health OK" indicator
   - If you see "Disconnected", check troubleshooting below

## Using Token via URL

If you need to set the token dynamically without redeploying:

```
https://your-app.com/?token=YOUR_GATEWAY_TOKEN
```

The token will be saved to localStorage and the URL will be cleaned.

## Troubleshooting

### Error: "Disconnected (1008): unauthorized: gateway token mismatch"

**Cause**: The frontend and backend are using different tokens.

**Fix**:
1. Ensure `GATEWAY_TOKEN` is set in Coolify environment variables
2. Restart the deployment
3. Clear browser localStorage and reload

### Error: "GATEWAY_TOKEN not configured" banner

**Cause**: The `GATEWAY_TOKEN` environment variable is not set.

**Fix**:
1. Go to Coolify → Your App → Environment Variables
2. Add: `GATEWAY_TOKEN=your-secure-random-token`
3. Redeploy

### Error: "OpenAI 401: You didn't provide an API key"

**Cause**: Trying to use OpenAI without setting the API key.

**Fix**:
1. Add `OPENAI_API_KEY=sk-...` to environment variables
2. Redeploy
3. Or select a different provider that is configured

### Health check shows "degraded"

**Cause**: Gateway process not running or token not configured.

**Fix**:
1. Check container logs for startup errors
2. Ensure `GATEWAY_TOKEN` is set
3. Verify no port conflicts

### Docker build fails with lockfile error

**Cause**: pnpm-lock.yaml out of sync.

**Fix**: This should be resolved in the current version. If it persists:
1. Pull latest code
2. Rebuild without cache in Coolify

## Verifying Deployment

### Health Check
```bash
curl https://your-app.com/health
```

Expected response:
```json
{
  "status": "ok",
  "gateway": { "status": "connected", "healthy": true },
  "token": { "configured": true },
  "providers": { "openai": true, "anthropic": false, ... }
}
```

### Gateway Health
```bash
curl https://your-app.com/gateway/health
```

Expected response:
```json
{ "status": "ok", "gateway": "connected" }
```

### Provider Status
```bash
curl https://your-app.com/api/providers/status
```

Shows which LLM providers are configured (without revealing keys).

## Security Notes

- Never commit API keys to the repository
- Use Coolify's environment variables for all secrets
- The `GATEWAY_TOKEN` should be at least 32 characters
- Tokens are never logged or exposed in responses
