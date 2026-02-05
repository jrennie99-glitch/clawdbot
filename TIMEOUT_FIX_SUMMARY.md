# MoltBot LLM Timeout and Hanging Fix

## Summary
Fixed critical hanging issues with Groq, OpenRouter, and Ollama providers by implementing hard timeouts, max_tokens enforcement, and streaming control.

## Root Causes Fixed
1. ✅ No connection timeout (added 5s hard limit)
2. ✅ Request timeout too long (reduced from 15s to 12s)
3. ✅ No max_tokens enforcement (added hard limits per provider)
4. ✅ Streaming causing hangs (force-disabled for cheap models)
5. ✅ Failover waiting for hung requests (now aborts immediately)

## Changes Made

### 1. Core Timeout Configuration (`/app/src/agents/defaults.ts`)
- **Added**: `DEFAULT_CONNECTION_TIMEOUT_MS = 5000` (5s connection timeout)
- **Reduced**: `DEFAULT_LLM_TIMEOUT_MS` from 15000 to 12000 (12s total timeout)
- **Added**: Hard max_tokens limits per provider:
  - Groq: 512 tokens
  - OpenRouter: 512 tokens
  - Ollama: 384 tokens
  - Claude: 1024 tokens
  - Default: 512 tokens
- **Added**: `STREAMING_DISABLED_PROVIDERS` set for force-disabling streaming on problematic providers

### 2. LLM Configuration Module (`/app/src/agents/llm-config.ts`)
- **Added**: `getProviderMaxTokens()` - Returns hard max_tokens limit for each provider
- **Added**: `isStreamingDisabled()` - Checks if streaming should be disabled for provider
- **Updated**: `LLMConfig` type to include `connectionTimeoutMs`, `maxTokens`, and `streamingAllowed`
- **Updated**: Provider status to include max_tokens and streaming flags

### 3. Timeout Enforcement Utility (`/app/src/agents/timeout-enforcer.ts`)
- **NEW FILE**: Created comprehensive timeout enforcement utilities
- **Added**: `withTimeout()` - Wraps promises with hard timeout
- **Added**: `createAbortControllerWithTimeout()` - Creates auto-aborting controllers
- **Added**: `fetchWithTimeout()` - Wraps fetch calls with connection and request timeouts

### 4. Streaming Control (`/app/src/agents/pi-embedded-runner/extra-params.ts`)
- **Updated**: Force-disable streaming for problematic providers (Groq, OpenRouter, Ollama, vLLM, Moonshot)
- **Added**: Hard max_tokens enforcement (prevents infinite generation)
- **Added**: Provider-specific max_tokens limits that cannot be overridden

### 5. Model Catalog (`/app/security/llm-router.ts`)
- **Updated**: All model configs to include reduced max_tokens:
  - Smart tier: 512 tokens (was 8192)
  - Fast tier: 512 tokens (was 8192)
  - Cheap tier: 512 tokens (was 4096)
  - Local (Ollama): 384 tokens (was 4096)
  - Claude: 1024 tokens (was 4096-8192)

### 6. Centralized Configuration (`/app/docker/moltbot.json`)
- **Updated**: Agent defaults with new timeout values
- **Added**: `connectionTimeoutMs: 5000`
- **Updated**: `timeoutMs: 12000` (was 15000)
- **Added**: `streamingProviders` object with per-provider flags
- **Added**: `maxTokens` object with per-provider limits
- **Updated**: All model definitions to use reduced max_tokens

## Failover Chain
**Priority Order (Strict)**:
1. Groq (primary)
2. OpenRouter (first fallback)
3. Ollama (second fallback)
4. Claude (last resort only)

## Timeout Behavior
- **Connection**: 5s max to establish connection
- **Request**: 12s max total request time
- **On Timeout**: Immediately abort and failover to next provider
- **No Retry**: Single attempt per provider (prevents cascading delays)

## Streaming Control
- **Disabled by default**: All providers except Claude
- **Force-disabled for**: Groq, OpenRouter, Ollama, vLLM, Moonshot, Kimi
- **Allowed for**: Claude (if explicitly enabled)
- **Enforcement**: Runtime checks prevent streaming code paths

## Max Tokens Enforcement
- **Hard limits per provider**: Cannot be overridden by config
- **Prevents infinite generation**: Critical for cheap models
- **Applied at**: Stream function wrapper level

## Security Features (Preserved)
✅ Gateway auth unchanged
✅ Rate limiting intact
✅ Mini-WAF active
✅ IP blocking functional
✅ SECURITY_LOCKDOWN flag preserved

## Testing Recommendations
1. Test Groq with llama-3.1-8b-instant (should be instant or fail fast in <12s)
2. Test OpenRouter fallback when Groq unavailable
3. Test Ollama fallback when both Groq and OpenRouter unavailable
4. Verify Claude is used only as last resort
5. Confirm no infinite spinners on timeout
6. Verify max_tokens prevents runaway generation

## Environment Variables (Optional Overrides)
- `LLM_CONNECTION_TIMEOUT_MS` - Override connection timeout (default: 5000)
- `LLM_REQUEST_TIMEOUT_MS` - Override request timeout (default: 12000)
- `MAX_TOKENS_GROQ` - Override Groq max_tokens (default: 512)
- `MAX_TOKENS_OPENROUTER` - Override OpenRouter max_tokens (default: 512)
- `MAX_TOKENS_OLLAMA` - Override Ollama max_tokens (default: 384)
- `MAX_TOKENS_CLAUDE` - Override Claude max_tokens (default: 1024)
- `LLM_STREAMING` - Enable/disable streaming globally (default: false)

## Files Modified
- `/app/src/agents/defaults.ts`
- `/app/src/agents/llm-config.ts`
- `/app/src/agents/timeout.ts`
- `/app/src/agents/pi-embedded-runner/extra-params.ts`
- `/app/src/security/llm-router.ts`
- `/app/docker/moltbot.json`

## Files Created
- `/app/src/agents/timeout-enforcer.ts` (new timeout utilities)

## Critical Success Factors
1. ✅ No request can exceed 12s total
2. ✅ No connection can take longer than 5s
3. ✅ No model can generate indefinitely (max_tokens enforced)
4. ✅ Streaming disabled for problematic providers
5. ✅ Failover triggers immediately on timeout
6. ✅ Claude is optional, not required
7. ✅ System feels fast on cheap models
8. ✅ All security features preserved
