# MoltBot LLM Provider Reliability Fix - PRD

## Original Problem Statement

MoltBot UI "hangs/stuck writing" when switching providers (Groq, Haiku, etc.). Goal: make MoltBot run FAST + RELIABLE with cheaper/open-source models (Groq/OpenRouter/Ollama) and STOP the "stuck writing forever" behavior when switching away from Claude.

### Primary Issues
1. UI hangs indefinitely when using non-Claude providers
2. No hard request timeouts - requests could hang forever
3. No provider status visibility
4. Claude-centric defaults made cheaper providers unreliable
5. Streaming mode caused issues with OpenAI-compatible APIs

## User Personas

- **Self-hosters**: Deploy on Coolify/Docker, want cheap/fast inference
- **Privacy-conscious users**: Use local Ollama, need reliable timeouts
- **Budget users**: Prefer Groq free tier over Claude API costs

## Core Requirements (Static)

| Requirement | Status |
|-------------|--------|
| Server-side request timeout (default 15s) | ✅ Implemented |
| Max retries with fail-fast (default 1) | ✅ Implemented |
| LLM_STREAMING=false default | ✅ Implemented |
| OpenAI-compatible provider support | ✅ Implemented |
| Provider status panel (boolean configured) | ✅ Implemented |
| Model test button with latency | ✅ Implemented |
| User-friendly error messages | ✅ Implemented |
| Groq/OpenRouter presets documented | ✅ Implemented |

## What's Been Implemented

### 2026-02-05

**New Files:**
- `/app/src/agents/llm-config.ts` - LLM configuration module with provider status
- `/app/src/gateway/server-methods/providers.ts` - Provider status/test gateway handlers

**Modified Files:**
- `/app/src/agents/defaults.ts` - Changed defaults to Groq, added timeout/streaming config
- `/app/src/agents/timeout.ts` - Use new DEFAULT_LLM_TIMEOUT_MS (15s vs old 600s)
- `/app/src/gateway/server-methods.ts` - Added providersHandlers
- `/app/src/gateway/server-methods-list.ts` - Added providers.status, providers.test methods
- `/app/docker/moltbot.json` - Added Groq/OpenRouter/Ollama provider configs with fallbacks
- `/app/env.example` - Full env var documentation
- `/app/CHANGELOG.md` - Documented changes
- `/app/docs/DEPLOY_COOLIFY.md` - Complete deployment guide with presets

**New Environment Variables:**
- DEFAULT_LLM_PROVIDER (default: groq)
- DEFAULT_MODEL (default: llama-3.1-8b-instant)
- LLM_STREAMING (default: false)
- LLM_REQUEST_TIMEOUT_MS (default: 15000)
- LLM_MAX_RETRIES (default: 1)
- GROQ_API_KEY
- OPENROUTER_API_KEY
- OLLAMA_BASE_URL
- OLLAMA_MODEL

**New Gateway Endpoints:**
- `providers.status` - Returns configured providers with status
- `providers.test` - Tests providers with latency measurement

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Fix default timeout from 600s to 15s
- [x] Disable streaming by default
- [x] Change default provider from anthropic to groq
- [x] Add provider status endpoint

### P1 (High) - DONE
- [x] Add provider test endpoint
- [x] Document Groq/OpenRouter presets
- [x] Update moltbot.json with failover config
- [x] User-friendly error formatting

### P2 (Medium) - Future
- [ ] Provider health check on gateway startup
- [ ] Auto-select fastest provider based on test results
- [ ] Streaming retry with non-streaming fallback
- [ ] Provider latency history tracking

### P3 (Low) - Future
- [ ] UI provider selection dropdown
- [ ] Visual latency indicator in chat
- [ ] Per-session provider override
- [ ] Cost tracking per provider

## Next Tasks

1. Test with actual Groq API key to verify end-to-end flow
2. Test with actual OpenRouter API key
3. Consider adding provider health checks on startup
4. Add UI components for provider status display
