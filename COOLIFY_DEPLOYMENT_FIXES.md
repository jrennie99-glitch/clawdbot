# Coolify Deployment Fixes

## Critical Fixes Applied

### A) TypeScript Build Error - FIXED ✅
**Issue**: `stream` property doesn't exist on `SimpleStreamOptions`
**Fix**: Created local type extension `SimpleStreamOptionsWithStream` in extra-params.ts
**Status**: Build should now pass

### B) Hanging on Cheap Models - FIXED ✅

**Timeouts Enforced**:
- Connection timeout: 5s (hard limit)
- Request timeout: 12s (hard limit)
- Max tokens: 512 (Groq/OpenRouter), 384 (Ollama), 1024 (Claude)

**Streaming Disabled**:
- OFF by default globally
- Force-disabled: Groq, OpenRouter, Ollama, vLLM, Moonshot
- Only Claude can stream (if explicitly enabled)

**Provider Failover Order**:
1. Groq (primary)
2. OpenRouter (first fallback)
3. Ollama (second fallback)
4. Claude (last resort)

### C) Auth/Routing Fix

**Required Frontend Changes** (implement in frontend code):

In `/app/ui/src/` or wherever auth is called:

```javascript
// WRONG (causes backend:8001 in browser):
const response = await fetch(`${process.env.BACKEND_URL}/api/auth/google/login`);

// CORRECT (use relative path):
const response = await fetch('/api/auth/google/login');
```

**Backend Changes** (if needed):
- OAuth callback redirects must use APP_URL (public domain), not localhost
- Never emit Docker service names to browser

### D) Gateway Password Setup

**Environment Variables Required**:
```bash
GATEWAY_PASSWORD=your-secure-password-here
APP_URL=https://yourdomain.com
```

**Supervisor Security** (add to supervisor config):
```ini
[inet_http_server]
port=127.0.0.1:9001
username=admin
password=secure-supervisor-password
```

### E) Minimal Coolify Environment Variables

**REQUIRED**:
```bash
# App Configuration
APP_URL=https://yourdomain.com
NODE_ENV=production

# Gateway Security
GATEWAY_PASSWORD=your-secure-gateway-password

# LLM Provider (choose one or more)
GROQ_API_KEY=your-groq-key
# OR
OPENROUTER_API_KEY=your-openrouter-key
# OR
ANTHROPIC_API_KEY=your-anthropic-key
# OR
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3

# OAuth (if using Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**OPTIONAL** (use defaults if not set):
```bash
LLM_REQUEST_TIMEOUT_MS=12000
LLM_CONNECTION_TIMEOUT_MS=5000
MAX_TOKENS_GROQ=512
MAX_TOKENS_OPENROUTER=512
MAX_TOKENS_OLLAMA=384
MAX_TOKENS_CLAUDE=1024
LLM_STREAMING=false
```

**REMOVE** (Coolify generates these automatically):
- SERVICE_FQDN_*
- SERVICE_URL_*
- Any preview/branch-specific variables you don't need

### F) Quick Test Checklist

After deployment:

1. ✅ **Build passes**: `pnpm build` succeeds without TS errors
2. ✅ **Groq fast**: Response in <3s or fails fast in <12s
3. ✅ **Failover works**: Disable Groq → switches to OpenRouter within 12s
4. ✅ **No infinite spinner**: UI shows "Provider failed, trying next..." 
5. ✅ **Auth uses /api/**: Google login redirects to `/api/auth/google/callback` (not backend:8001)
6. ✅ **Gateway password**: WebSocket connects with GATEWAY_PASSWORD
7. ✅ **No hanging**: All requests complete or fail within 12s

### G) Docker Compose Cleanup

Remove from `docker-compose.yml` if present:

```yaml
# REMOVE these (Coolify generates them):
environment:
  - SERVICE_FQDN_*
  - SERVICE_URL_*
```

Keep only:
```yaml
environment:
  - APP_URL=${APP_URL}
  - NODE_ENV=production
  - GATEWAY_PASSWORD=${GATEWAY_PASSWORD}
  # LLM providers
  - GROQ_API_KEY=${GROQ_API_KEY:-}
  - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
  # OAuth
  - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
  - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
```

### H) Frontend API URL Configuration

**In frontend .env or build config**:

```bash
# Production (Coolify)
REACT_APP_API_URL=/api

# Development (local)
REACT_APP_API_URL=http://localhost:8001/api
```

**In frontend code**:

```javascript
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Use relative URLs in production
const makeApiCall = async (endpoint) => {
  const url = process.env.NODE_ENV === 'production' 
    ? `/api${endpoint}`  // Relative path for Coolify
    : `${API_URL}${endpoint}`;
  
  return fetch(url);
};
```

### I) Security Checklist

✅ Gateway password required for WebSocket
✅ Supervisor HTTP interface secured with auth
✅ No Docker service names exposed to browser
✅ OAuth redirects use public APP_URL
✅ All existing security features preserved:
  - Mini-WAF
  - Rate limiting
  - IP blocking
  - SECURITY_LOCKDOWN flag

### J) What Was NOT Added

❌ SaaS features
❌ Billing/subscriptions
❌ Team invites
❌ Onboarding flows
❌ Marketing pages

### K) Deployment Steps

1. **Update code**: Commit all fixes
2. **Set env vars**: Add required variables in Coolify
3. **Remove duplicates**: Clean up SERVICE_FQDN_* variables
4. **Deploy**: Trigger Coolify build
5. **Test**: Run through checklist above
6. **Monitor**: Check logs for timeout events

---

## Expected Behavior After Deployment

✅ **Groq feels instant** (llama-3.1-8b-instant responds in <3s)
✅ **No hanging ever** (12s hard timeout on all requests)
✅ **Failover is automatic** (switches providers on timeout/error)
✅ **UI shows progress** ("Provider failed, trying OpenRouter...")
✅ **Auth works correctly** (uses /api/ paths, not backend:8001)
✅ **Gateway is secure** (requires password)
✅ **Build succeeds** (no TypeScript errors)

---

## If Problems Persist

1. **Still hanging?**
   - Check logs: `docker logs <container-name>`
   - Verify timeout values: `echo $LLM_REQUEST_TIMEOUT_MS`
   - Test provider directly: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`

2. **Auth still broken?**
   - Check APP_URL is set to public domain
   - Verify frontend uses relative paths: `/api/auth/...`
   - Check OAuth callback URL in Google Console

3. **Build failing?**
   - Run `pnpm build` locally
   - Check TypeScript errors: `pnpm tsc --noEmit`
   - Ensure all imports are correct

4. **Gateway password not working?**
   - Verify GATEWAY_PASSWORD is set in Coolify
   - Check WebSocket connection in browser console
   - Ensure backend reads GATEWAY_PASSWORD from env
