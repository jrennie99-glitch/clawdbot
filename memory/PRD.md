# MoltBot - Production Ready

## Status: PRODUCTION READY ✅

### Recent Fixes (Feb 3, 2026)

1. **Gateway Token Mismatch (1008 error)** - FIXED
   - Token now read exclusively from `GATEWAY_TOKEN` env var
   - Removed hardcoded token from config files
   - Frontend and backend use same token source
   - Support for `?token=` URL parameter for easy access

2. **Security Headers** - FIXED
   - Removed `X-Powered-By` header
   - Added CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
   - HSTS enabled when behind HTTPS proxy

3. **Health Endpoint** - IMPROVED
   - Now checks actual gateway connectivity
   - Returns `degraded` status if gateway unreachable
   - Shows provider configuration status

4. **LLM Provider Status** - ADDED
   - `/api/providers/status` endpoint
   - Shows which providers are configured (without revealing keys)
   - Startup logs show provider status

5. **npm Vulnerabilities** - PARTIALLY FIXED
   - Updated `tar` to 7.5.7
   - Documented remaining vulnerabilities in SECURITY_NOTES.md

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GATEWAY_TOKEN` | **YES** | Shared auth token for gateway |
| `PORT` | No | Server port (default: 3000) |

## Optional LLM Provider Keys

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `MOONSHOT_API_KEY` / `KIMI_API_KEY`
- `OPENROUTER_API_KEY`
- `OLLAMA_BASE_URL`

## Documentation

- `/app/docs/DEPLOY_COOLIFY.md` - Coolify deployment guide
- `/app/SECURITY_NOTES.md` - Security vulnerability documentation
- `/app/env.example` - Environment variable reference

## Verification

```bash
# Health check
curl https://your-app.com/health

# Gateway health
curl https://your-app.com/gateway/health

# Provider status
curl https://your-app.com/api/providers/status
```
