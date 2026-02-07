# MoltBot Coolify Deployment Guide

## Coolify Configuration

### Build Settings
| Setting | Value |
|---------|-------|
| **Build Type** | Dockerfile |
| **Dockerfile Location** | `/Dockerfile` |
| **Build Context** | `/` (root) |

### Network Settings
| Setting | Value |
|---------|-------|
| **Exposed Port** | `8001` (UI/WebSocket) |
| **Gateway Port** | `3002` (API) |
| **Health Check Path** | `/healthz` |
| **Health Check Interval** | `30s` |

### Start Command
Leave empty - Dockerfile CMD handles this via supervisor.

### Environment Variables (Required)
```
NODE_ENV=production
PORT=8001
GATEWAY_PORT=3002
GATEWAY_TOKEN=<generate-secure-token>
```

### Environment Variables (Optional)
```
# Free / common provider keys
DEEPSEEK_API_KEY=<your-deepseek-key>
GOOGLE_API_KEY=<your-google-ai-studio-key>
OPENROUTER_API_KEY=<your-openrouter-key>

# Other providers (optional)
KIMI_API_KEY=<your-moonshot-api-key>
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>

PUBLIC_URL=https://your-domain.com
```

---

## WebSocket Configuration

WebSocket connections work automatically:
- Frontend detects `https://` → uses `wss://`
- Frontend detects `http://` → uses `ws://`
- Coolify's reverse proxy handles WebSocket upgrade

**No additional WebSocket configuration needed in Coolify.**

---

## Verification Steps

After deployment:

1. **Health Check**
   ```bash
   curl https://your-domain.com/health
   # Expected: {"status":"ok","version":"1.0.0",...}
   ```

2. **Gateway Health**
   ```bash
   curl https://your-domain.com/gateway/health
   # Expected: {"status":"ok","gateway":"connected"}
   ```

3. **UI Access**
   - Open `https://your-domain.com` in browser
   - Should show "Health OK" indicator (top right)
   - Chat interface should be active

4. **WebSocket Test**
   - Open browser DevTools → Network → WS
   - Should see active WebSocket connection
   - No 1006 errors

---

## Troubleshooting

### WebSocket 1006 Error
- Ensure Coolify proxy supports WebSocket upgrades (default: yes)
- Check `GATEWAY_TOKEN` matches in env vars
- Verify gateway is running: `curl /gateway/health`

### Gateway Unreachable
- Check supervisor logs in container
- Verify port 8001 is not blocked internally
- Ensure NODE_ENV=production

### UI Shows Disconnected
- Clear browser localStorage
- Reload page
- Check browser console for errors
