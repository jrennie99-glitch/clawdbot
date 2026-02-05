# Docker Compose Cleanup for Coolify Deployment

## Problem
Coolify generates SERVICE_FQDN_* and SERVICE_URL_* variables automatically, but if they're also in docker-compose.yml, you get duplicates and conflicts.

## Solution

### 1. Minimal docker-compose.yml

If you have a `docker-compose.yml` or `docker-compose.prod.yml`, clean it up:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      # Core configuration
      - NODE_ENV=production
      - APP_URL=${APP_URL}
      
      # Security
      - GATEWAY_PASSWORD=${GATEWAY_PASSWORD}
      
      # LLM Providers (use :- for optional with empty default)
      - GROQ_API_KEY=${GROQ_API_KEY:-}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-}
      - OLLAMA_MODEL=${OLLAMA_MODEL:-}
      
      # OAuth (optional)
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
      
      # Optional overrides
      - LLM_REQUEST_TIMEOUT_MS=${LLM_REQUEST_TIMEOUT_MS:-12000}
      - LLM_CONNECTION_TIMEOUT_MS=${LLM_CONNECTION_TIMEOUT_MS:-5000}
      - LLM_STREAMING=${LLM_STREAMING:-false}
    ports:
      - "8001:8001"  # Backend API
      - "3000:3000"  # Frontend (if serving from same container)
    restart: unless-stopped
```

### 2. Remove These Lines

**DELETE** these if present:

```yaml
# DO NOT INCLUDE:
- SERVICE_FQDN_APP=${SERVICE_FQDN_APP}
- SERVICE_URL_APP=${SERVICE_URL_APP}
- SERVICE_FQDN_BACKEND=${SERVICE_FQDN_BACKEND}
- SERVICE_URL_BACKEND=${SERVICE_URL_BACKEND}
- COOLIFY_*=${COOLIFY_*}
```

Coolify automatically generates these and injects them at runtime.

### 3. Dockerfile Configuration

Ensure your Dockerfile uses ARGs for build-time variables only:

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build (no ARGs needed here - use env vars at runtime)
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose ports
EXPOSE 8001 3000

# Start application
CMD ["node", "dist/index.js"]
```

### 4. Coolify Environment Variables Setup

In Coolify UI, set these variables:

**Required**:
- `APP_URL` → https://yourdomain.com
- `GATEWAY_PASSWORD` → strong-password-here
- `GROQ_API_KEY` → gsk_...

**Optional**:
- `OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Do NOT set** in Coolify (let defaults work):
- `SERVICE_FQDN_*` (auto-generated)
- `NODE_ENV` (Coolify sets this)
- Timeout/token limits (use defaults)

### 5. Verify No Conflicts

After cleanup, verify in Coolify UI:

1. Go to Environment Variables
2. Check for duplicates
3. Delete any SERVICE_FQDN_* or SERVICE_URL_* that show "from docker compose"
4. Keep only the ones "from settings"

### 6. Path Routing Configuration

In Coolify, configure path routing:

**Frontend** (React):
- Path: `/`
- Port: `3000`

**Backend** (API):
- Path: `/api`
- Port: `8001`

This ensures:
- `yourdomain.com/` → Frontend (port 3000)
- `yourdomain.com/api/*` → Backend (port 8001)

### 7. Test After Deployment

```bash
# Should hit frontend
curl https://yourdomain.com/

# Should hit backend
curl https://yourdomain.com/api/health

# Should NOT work (no Docker hostnames in browser)
# ❌ backend:8001/api/...
```

## Common Issues

### Issue 1: "Can't delete env var - comes from docker compose"

**Solution**: Edit docker-compose.yml and remove that variable line, then redeploy.

### Issue 2: OAuth redirects to "backend:8001"

**Solution**: 
1. Set `APP_URL=https://yourdomain.com` in Coolify
2. Ensure frontend uses relative paths: `/api/auth/...`
3. Register callback in Google Console: `https://yourdomain.com/api/auth/google/callback`

### Issue 3: Frontend can't reach backend

**Solution**: Check Coolify path routing is configured:
- `/` → port 3000
- `/api` → port 8001

### Issue 4: Still getting SERVICE_FQDN errors

**Solution**: 
1. Remove ALL references from docker-compose.yml
2. Clear Coolify build cache
3. Redeploy from scratch

## Verification Checklist

After cleanup:

- [ ] docker-compose.yml has no SERVICE_FQDN_* variables
- [ ] docker-compose.yml has no SERVICE_URL_* variables
- [ ] Coolify shows no duplicate env vars
- [ ] APP_URL is set to public domain
- [ ] Build succeeds without errors
- [ ] Frontend serves at yourdomain.com/
- [ ] Backend responds at yourdomain.com/api/
- [ ] OAuth redirects use /api/ paths
- [ ] No "backend:8001" in browser network tab
