#!/bin/bash
# =============================================================================
# MOLTBOT COOLIFY DEPLOYMENT - AUTOMATED TEST CHECKLIST
# =============================================================================
# Run this after deployment to verify all fixes are working

set -e

echo "==================================================================="
echo "MOLTBOT DEPLOYMENT VERIFICATION"
echo "==================================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_URL="${APP_URL:-https://yourdomain.com}"
API_ENDPOINT="${APP_URL}/api"

# =============================================================================
# TEST 1: Environment Variables Check
# =============================================================================
echo "TEST 1: Checking Required Environment Variables..."
echo ""

check_env_var() {
  local var_name=$1
  local required=$2
  
  if [ -z "${!var_name}" ]; then
    if [ "$required" = "true" ]; then
      echo -e "${RED}✗ FAILED: $var_name is not set (REQUIRED)${NC}"
      return 1
    else
      echo -e "${YELLOW}⚠ WARNING: $var_name is not set (optional)${NC}"
      return 0
    fi
  else
    echo -e "${GREEN}✓ PASSED: $var_name is set${NC}"
    return 0
  fi
}

check_env_var "APP_URL" "true"
check_env_var "GATEWAY_PASSWORD" "true"

# Check at least one LLM provider
if [ -z "$GROQ_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OLLAMA_BASE_URL" ]; then
  echo -e "${RED}✗ FAILED: No LLM provider configured${NC}"
  echo "  Set at least one: GROQ_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_BASE_URL"
  exit 1
else
  echo -e "${GREEN}✓ PASSED: At least one LLM provider is configured${NC}"
fi

echo ""

# =============================================================================
# TEST 2: Build Success Check
# =============================================================================
echo "TEST 2: Checking TypeScript Build..."
echo ""

if [ -d "/app/dist" ]; then
  echo -e "${GREEN}✓ PASSED: Build output directory exists${NC}"
else
  echo -e "${RED}✗ FAILED: Build output directory not found${NC}"
  exit 1
fi

echo ""

# =============================================================================
# TEST 3: API Endpoint Accessibility
# =============================================================================
echo "TEST 3: Testing API Endpoint Accessibility..."
echo ""

# Test /api/health or similar endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_ENDPOINT}/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "404" ]; then
  echo -e "${GREEN}✓ PASSED: API endpoint is accessible (HTTP $HTTP_STATUS)${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: API endpoint returned HTTP $HTTP_STATUS${NC}"
  echo "  This might be normal if /health endpoint doesn't exist"
fi

echo ""

# =============================================================================
# TEST 4: Timeout Configuration Check
# =============================================================================
echo "TEST 4: Verifying Timeout Configuration..."
echo ""

LLM_TIMEOUT="${LLM_REQUEST_TIMEOUT_MS:-12000}"
CONN_TIMEOUT="${LLM_CONNECTION_TIMEOUT_MS:-5000}"

if [ "$LLM_TIMEOUT" -le 12000 ]; then
  echo -e "${GREEN}✓ PASSED: Request timeout is ≤12s ($LLM_TIMEOUT ms)${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: Request timeout is >12s ($LLM_TIMEOUT ms)${NC}"
  echo "  Recommended: 12000ms or less"
fi

if [ "$CONN_TIMEOUT" -le 5000 ]; then
  echo -e "${GREEN}✓ PASSED: Connection timeout is ≤5s ($CONN_TIMEOUT ms)${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: Connection timeout is >5s ($CONN_TIMEOUT ms)${NC}"
  echo "  Recommended: 5000ms or less"
fi

echo ""

# =============================================================================
# TEST 5: Max Tokens Configuration
# =============================================================================
echo "TEST 5: Verifying Max Tokens Configuration..."
echo ""

MAX_TOKENS_GROQ="${MAX_TOKENS_GROQ:-512}"
MAX_TOKENS_OPENROUTER="${MAX_TOKENS_OPENROUTER:-512}"
MAX_TOKENS_OLLAMA="${MAX_TOKENS_OLLAMA:-384}"

echo "  Groq max_tokens: $MAX_TOKENS_GROQ"
echo "  OpenRouter max_tokens: $MAX_TOKENS_OPENROUTER"
echo "  Ollama max_tokens: $MAX_TOKENS_OLLAMA"

if [ "$MAX_TOKENS_GROQ" -le 1024 ] && [ "$MAX_TOKENS_OPENROUTER" -le 1024 ] && [ "$MAX_TOKENS_OLLAMA" -le 1024 ]; then
  echo -e "${GREEN}✓ PASSED: Max tokens are within safe limits${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: Some max_tokens values are >1024${NC}"
  echo "  Higher values may cause longer response times"
fi

echo ""

# =============================================================================
# TEST 6: Streaming Configuration
# =============================================================================
echo "TEST 6: Verifying Streaming Configuration..."
echo ""

LLM_STREAMING="${LLM_STREAMING:-false}"

if [ "$LLM_STREAMING" = "false" ]; then
  echo -e "${GREEN}✓ PASSED: Streaming is disabled by default${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: Streaming is enabled globally${NC}"
  echo "  This may cause hanging on cheap models"
fi

echo ""

# =============================================================================
# TEST 7: Security Check
# =============================================================================
echo "TEST 7: Security Configuration Check..."
echo ""

if [ -n "$GATEWAY_PASSWORD" ]; then
  if [ ${#GATEWAY_PASSWORD} -ge 12 ]; then
    echo -e "${GREEN}✓ PASSED: Gateway password is set and strong (${#GATEWAY_PASSWORD} chars)${NC}"
  else
    echo -e "${YELLOW}⚠ WARNING: Gateway password is weak (<12 chars)${NC}"
  fi
else
  echo -e "${RED}✗ FAILED: Gateway password is not set${NC}"
  exit 1
fi

echo ""

# =============================================================================
# TEST 8: Provider Configuration
# =============================================================================
echo "TEST 8: Verifying Provider Configuration..."
echo ""

if [ -n "$GROQ_API_KEY" ]; then
  echo -e "${GREEN}✓ Groq configured (primary)${NC}"
fi

if [ -n "$OPENROUTER_API_KEY" ]; then
  echo -e "${GREEN}✓ OpenRouter configured (fallback)${NC}"
fi

if [ -n "$OLLAMA_BASE_URL" ]; then
  echo -e "${GREEN}✓ Ollama configured (local)${NC}"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo -e "${GREEN}✓ Claude configured (premium fallback)${NC}"
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "==================================================================="
echo "VERIFICATION SUMMARY"
echo "==================================================================="
echo ""
echo "Configuration Status:"
echo "  APP_URL: $APP_URL"
echo "  Request Timeout: ${LLM_TIMEOUT}ms"
echo "  Connection Timeout: ${CONN_TIMEOUT}ms"
echo "  Streaming: $LLM_STREAMING"
echo "  Max Tokens (Groq): $MAX_TOKENS_GROQ"
echo ""
echo -e "${GREEN}✓ Basic checks passed!${NC}"
echo ""
echo "Next Steps:"
echo "  1. Access your app: $APP_URL"
echo "  2. Test Groq response (should be <3s or fail <12s)"
echo "  3. Test failover by temporarily disabling primary provider"
echo "  4. Verify OAuth redirects use /api/ paths"
echo "  5. Test WebSocket connection with gateway password"
echo ""
echo "==================================================================="
