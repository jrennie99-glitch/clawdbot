# Coolify Deployment - REQUIRED Environment Variables

## CRITICAL MINIMUM (Must Set These)

### App URL
```bash
APP_URL=https://yourdomain.com
```
**Purpose**: Public-facing URL for OAuth callbacks and API routing  
**Required**: Yes  
**Example**: `https://moltbot.example.com`

### Gateway Password
```bash
GATEWAY_PASSWORD=your-secure-random-password-min-16-chars
```
**Purpose**: Secures WebSocket gateway connections  
**Required**: Yes (or gateway will run in disabled mode)  
**Minimum Length**: 16 characters recommended  
**Generate**: `openssl rand -base64 24`

### Session Secret
```bash
SESSION_SECRET=your-secure-random-session-secret
```
**Purpose**: Encrypts session cookies  
**Required**: Yes  
**Generate**: `openssl rand -base64 32`

### LLM Provider (Choose At Least One)

#### Option 1: Groq (RECOMMENDED - Fastest)
```bash
GROQ_API_KEY=gsk_your_groq_api_key_here
```
**Get Key**: https://console.groq.com/keys  
**Cost**: Very cheap (~$0.05-0.10 per million tokens)  
**Speed**: 100-200 tokens/sec  

#### Option 2: OpenRouter (Good Fallback)
```bash
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
```
**Get Key**: https://openrouter.ai/keys  
**Cost**: Variable by model  

#### Option 3: Claude (Premium, Last Resort)
```bash
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key_here
```
**Get Key**: https://console.anthropic.com/  
**Cost**: Higher (~$3-15 per million tokens)  

#### Option 4: Ollama (Self-Hosted, Free)
```bash
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3
```
**Setup**: Requires separate Ollama service  
**Cost**: Free (uses your compute)  

---

## OPTIONAL (Good Defaults Provided)

### OAuth (Google Login)
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```
**Required For**: Google social login only  
**Register**: https://console.cloud.google.com/apis/credentials  
**Callback URL**: `https://yourdomain.com/api/auth/google/callback`

### LLM Timeouts (Usually Don't Need to Change)
```bash
# Connection timeout (how long to wait for connection)
LLM_CONNECTION_TIMEOUT_MS=5000

# Total request timeout (max time for entire request)
LLM_REQUEST_TIMEOUT_MS=12000

# Streaming (OFF by default to prevent hanging)
LLM_STREAMING=false
```

### Max Tokens Per Provider
```bash
# Groq max tokens (prevents infinite generation)
MAX_TOKENS_GROQ=512

# OpenRouter max tokens
MAX_TOKENS_OPENROUTER=512

# Ollama max tokens
MAX_TOKENS_OLLAMA=384

# Claude max tokens
MAX_TOKENS_CLAUDE=1024
```

### Default Provider
```bash
# Which provider to try first
DEFAULT_LLM_PROVIDER=groq
```

---

## DO NOT SET (Coolify Auto-Generates)

❌ `SERVICE_FQDN_*` - Coolify generates these  
❌ `SERVICE_URL_*` - Coolify generates these  
❌ `NODE_ENV` - Automatically set to "production"  
❌ `PORT` - Coolify assigns this  

---

## Quick Setup Guide

### 1. Set Required Variables in Coolify UI

Go to your app → Environment → Add these:

```bash
APP_URL=https://yourdomain.com
GATEWAY_PASSWORD=$(openssl rand -base64 24)
SESSION_SECRET=$(openssl rand -base64 32)
GROQ_API_KEY=gsk_your_api_key_here
```

### 2. Configure Path Routing (If Needed)

If frontend and backend are separate:
- Frontend: Path `/` → Port 3000
- Backend: Path `/api` → Port 8001

### 3. Deploy

Click "Deploy" in Coolify

### 4. Verify Health

```bash
curl https://yourdomain.com/healthz
# Should return: {"status":"ok","timestamp":...}
```

### 5. Test LLM

The app should now:
- ✅ Start without crashing
- ✅ Health check passes (200 OK)
- ✅ Groq responses in <3s
- ✅ Failover to OpenRouter if Groq fails
- ✅ No infinite spinners
- ✅ Timeout after 12s max

---

## Common Issues

### Issue: Gateway crash-loops with exit code 1

**Cause**: Missing `GATEWAY_PASSWORD` or `SESSION_SECRET`  
**Fix**: Set both required env vars in Coolify

### Issue: Healthcheck returns 503

**Cause**: App not starting, check logs  
**Fix**: 
1. Check env vars are set
2. View logs in Coolify
3. Verify `GROQ_API_KEY` or another provider is configured

### Issue: OAuth redirects to "backend:8001"

**Cause**: Frontend using wrong API URL  
**Fix**: 
1. Ensure `APP_URL` is set to public domain
2. Frontend should use relative paths: `/api/auth/...`

### Issue: "Can't delete env var - from docker compose"

**Cause**: Variable is in docker-compose.yml  
**Fix**: Remove it from docker-compose.yml, let Coolify manage it

### Issue: LLM requests hang forever

**Cause**: Old code without timeouts (should be fixed now)  
**Verify**: Check logs for "Request timeout after 12000ms"  
**Expected**: All requests complete or fail within 12s

---

## Security Checklist

✅ `GATEWAY_PASSWORD` is 16+ characters  
✅ `SESSION_SECRET` is 32+ characters  
✅ `APP_URL` uses HTTPS (not HTTP)  
✅ No API keys committed to git  
✅ OAuth callback registered in Google Console  
✅ Supervisor HTTP interface secured (or disabled)  

---

## Testing After Deployment

### 1. Health Check
```bash
curl https://yourdomain.com/healthz
# Expected: {"status":"ok","timestamp":1234567890}
```

### 2. Gateway Status
```bash
# Check if gateway accepted connection
# Look for WebSocket connection in browser dev tools
```

### 3. LLM Test
```bash
# Send a test message
# Expected: Response in <3s or timeout in <12s
```

### 4. Failover Test
```bash
# Temporarily disable GROQ_API_KEY
# Expected: Switches to OpenRouter within 12s
```

---

## Need Help?

1. Check Coolify logs: App → Logs
2. Check browser console for errors
3. Verify all required env vars are set
4. Test /healthz endpoint
5. Review error messages in logs

---

## Summary

**Absolute Minimum to Deploy**:
```bash
APP_URL=https://yourdomain.com
GATEWAY_PASSWORD=<generate-secure-password>
SESSION_SECRET=<generate-secure-secret>
GROQ_API_KEY=gsk_<your-key>
```

Everything else has sensible defaults or is optional.
