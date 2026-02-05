# WEBSOCKET ERROR 1011 FIX - DEPLOYMENT CHECKLIST

## Error Symptoms (What You're Seeing)
- ❌ "disconnected (1011): Gateway error"
- ❌ "Health Offline"
- ❌ Chat not working
- ❌ WebSocket disconnects immediately

## Root Cause
**Supervisor config using %(ENV_*)s expansions that fail when env vars missing**
- When `GATEWAY_TOKEN` not set → `%(ENV_GATEWAY_TOKEN)s` fails
- Supervisor crashes
- Gateway never starts
- WebSocket gets 1011 error

## What We Fixed

### 1. Supervisor Config (`/app/docker/supervisord.conf`) ✅
**REMOVED**: All `%(ENV_GATEWAY_TOKEN)s` and similar expansions
**CHANGED TO**: Inherit env vars from container automatically
```ini
# BEFORE (BROKEN):
environment=...,GATEWAY_TOKEN="%(ENV_GATEWAY_TOKEN)s",...

# AFTER (FIXED):
environment=NODE_ENV="production"
```

### 2. Gateway Startup Script (`/app/docker/start-gateway.sh`) ✅
**CREATED**: Safe wrapper with defaults
```bash
export CLAWDBOT_GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-8001}"
export CLAWDBOT_GATEWAY_BIND="${CLAWDBOT_GATEWAY_BIND:-0.0.0.0}"
```

### 3. Gateway CLI (`/app/src/cli/gateway-cli/run.ts`) ✅
**CHANGED**: Non-fatal mode when auth missing
- Warns but doesn't crash
- Runs in disabled mode
- Process stays alive

### 4. Health Endpoint (`/app/src/gateway/server-http.ts`) ✅
**ADDED**: `/healthz` endpoint that always works
- Returns 200 even if gateway disabled
- No auth required

### 5. Dockerfile (`/app/Dockerfile`) ✅
**UPDATED**: Use `/healthz` for healthcheck
- Healthcheck passes even in disabled mode

---

## Quick Deployment Steps

### 1. Verify Your Code Has These Changes
```bash
# Check supervisor config (should have NO %(ENV_*)s)
grep "%(ENV_" /app/docker/supervisord.conf
# Expected: NO OUTPUT (nothing found)

# Check startup script exists
ls -la /app/docker/start-gateway.sh
# Expected: File exists and is executable
```

### 2. Set Required Env Vars in Coolify

**CRITICAL - Set these in Coolify UI**:
```bash
# These are REQUIRED for gateway to work
GATEWAY_PASSWORD=your-secure-password-here
# OR
GATEWAY_TOKEN=your-secure-token-here

# Also recommended:
SESSION_SECRET=your-session-secret
GROQ_API_KEY=gsk_your_groq_key
APP_URL=https://yourdomain.com
```

**Generate secure values**:
```bash
# Gateway password
openssl rand -base64 24

# Session secret
openssl rand -base64 32
```

### 3. Deploy in Coolify
1. Push code to git
2. Trigger deploy in Coolify
3. Wait for build to complete

### 4. Verify Deployment

#### Check Health Endpoint
```bash
curl https://yourdomain.com/healthz
# Expected: {"status":"ok","timestamp":1234567890}
```

#### Check Supervisor Logs
```bash
# In Coolify, view logs or SSH into container
docker exec <container-id> tail -f /var/log/supervisor/gateway.out.log

# Expected to see:
# [gateway] Starting with:
#   Port: 8001
#   Bind: 0.0.0.0
#   Gateway Password: SET
```

#### Check Gateway Status
```bash
# In container
docker exec <container-id> supervisorctl status

# Expected:
# gateway                          RUNNING   pid 123, uptime 0:01:23
# frontend                         RUNNING   pid 124, uptime 0:01:23
```

### 5. Test WebSocket Connection

**In Browser**:
1. Open https://yourdomain.com
2. Go to Chat section
3. Should see: **Connected** (not "disconnected (1011)")

**If still getting error 1011**:
Check these logs:
```bash
# Gateway errors
docker exec <container> tail -100 /var/log/supervisor/gateway.err.log

# Look for:
# - "No password configured" → Set GATEWAY_PASSWORD
# - "Port already in use" → Check port conflicts
# - Any stack traces → Report error
```

---

## Troubleshooting

### Issue: Still getting "disconnected (1011)"

**Possible Causes**:

#### 1. Gateway Not Running
```bash
docker exec <container> supervisorctl status gateway
# If shows: FATAL, STOPPED, or EXITED
# → Check logs: tail /var/log/supervisor/gateway.err.log
```

**Fix**: 
- Check if GATEWAY_PASSWORD or GATEWAY_TOKEN is set
- Look for error messages in logs

#### 2. Wrong Port/Bind
```bash
# Check gateway is listening on correct port
docker exec <container> netstat -tlnp | grep 8001
# Expected: tcp 0 0 0.0.0.0:8001 LISTEN
```

**Fix**:
- Set `CLAWDBOT_GATEWAY_PORT=8001`
- Set `CLAWDBOT_GATEWAY_BIND=0.0.0.0`

#### 3. Supervisor Config Still Has %(ENV_*)s
```bash
docker exec <container> grep "%(ENV_" /etc/supervisor/conf.d/moltbot.conf
# Expected: NO OUTPUT
```

**Fix**:
- Rebuild Docker image (old config cached)
- `docker build --no-cache`

#### 4. Frontend Can't Reach Gateway
```bash
# Check frontend logs
docker exec <container> tail -100 /var/log/supervisor/frontend.out.log

# Look for connection errors
```

**Fix**:
- Verify APP_URL is set correctly
- Check network connectivity

### Issue: "Health Offline"

**Causes**:
1. Gateway crashed (check logs)
2. Auth not configured (set GATEWAY_PASSWORD)
3. Port conflict (check netstat)

**Fix**:
```bash
# Restart gateway
docker exec <container> supervisorctl restart gateway

# Watch logs
docker exec <container> tail -f /var/log/supervisor/gateway.out.log
```

### Issue: Build Fails

**Error**: `error TS2304: Cannot find name 'bindHost'`

**Fix**: 
- This is already fixed in `/app/src/gateway/server-http.ts`
- Pull latest code
- Rebuild

**Error**: Supervisor fails to start

**Fix**:
- Check for %(ENV_*)s in supervisor config
- Should only have `environment=NODE_ENV="production"`

---

## Expected Behavior After Fix

### Without GATEWAY_PASSWORD Set
- ⚠️ Gateway logs: "No password configured, running in DISABLED mode"
- ✅ Gateway process running (not crashed)
- ✅ `/healthz` returns 200
- ❌ WebSocket connections rejected (by design - security)
- ⚠️ UI shows: "disconnected" but with clear error message

### With GATEWAY_PASSWORD Set
- ✅ Gateway logs: "Gateway started successfully"
- ✅ Gateway process running
- ✅ `/healthz` returns 200
- ✅ WebSocket connects successfully
- ✅ Chat works
- ✅ Health shows: "Online"

---

## Final Verification Checklist

After deployment, verify these:

- [ ] Build succeeded (no TypeScript errors)
- [ ] Docker container started
- [ ] Healthcheck passes: `curl /healthz` returns 200
- [ ] Supervisor status shows gateway RUNNING
- [ ] Gateway logs show startup config
- [ ] Frontend loads in browser
- [ ] WebSocket connects (if auth set)
- [ ] No "disconnected (1011)" error
- [ ] Chat works (can send messages)
- [ ] Health status shows "Online"

---

## Quick Fix Commands

```bash
# 1. Check supervisor status
docker exec <container> supervisorctl status

# 2. Restart gateway
docker exec <container> supervisorctl restart gateway

# 3. View gateway logs
docker exec <container> tail -100 /var/log/supervisor/gateway.out.log

# 4. Check for errors
docker exec <container> tail -100 /var/log/supervisor/gateway.err.log

# 5. Verify healthcheck
curl https://yourdomain.com/healthz

# 6. Check env vars in container
docker exec <container> env | grep -E "GATEWAY|PORT|BIND"
```

---

## Need Help?

If still seeing "disconnected (1011)" after following this guide:

1. **Get logs**:
   ```bash
   docker exec <container> tail -200 /var/log/supervisor/gateway.err.log > gateway-error.log
   ```

2. **Check supervisor status**:
   ```bash
   docker exec <container> supervisorctl status > supervisor-status.txt
   ```

3. **Get env vars** (redact sensitive values):
   ```bash
   docker exec <container> env | grep -E "GATEWAY|CLAWDBOT" > env-vars.txt
   ```

4. Share these files for debugging

---

## Summary

**The Fix**: Removed %(ENV_*)s expansions from supervisor config that crashed when env vars missing

**The Result**: Gateway stays up, runs in disabled mode if auth missing, never crashes

**To Make It Work**: Set `GATEWAY_PASSWORD` or `GATEWAY_TOKEN` in Coolify env vars

**Deployment**: Push code → Set env vars → Deploy → Verify health → Test WebSocket

---

**STATUS: READY TO FIX YOUR ERROR 1011**

Follow the deployment steps above and the "disconnected (1011): Gateway error" will be resolved!
