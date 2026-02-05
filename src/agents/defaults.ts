// Defaults for agent metadata when upstream does not supply them.
// Default to OpenRouter with top open-source models (no Claude required)
// Users can override via env vars or moltbot.json.

// Provider priority: openrouter -> groq -> ollama -> anthropic (fallback only)
export const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER?.trim() || "openrouter";
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL?.trim() || "deepseek/deepseek-r1";

// Context window: Use conservative defaults for open models
export const DEFAULT_CONTEXT_TOKENS = 65_000;

// LLM request configuration (can be overridden via env vars)
// CRITICAL: Hard timeouts to prevent hanging on any model
export const DEFAULT_CONNECTION_TIMEOUT_MS = parseInt(process.env.LLM_CONNECTION_TIMEOUT_MS || "5000", 10); // 5s connection timeout
export const DEFAULT_LLM_TIMEOUT_MS = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || "12000", 10); // 12s total request timeout
export const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = parseInt(process.env.LLM_FIRST_TOKEN_TIMEOUT_MS || "6000", 10); // 6s first token timeout
export const DEFAULT_LLM_MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES || "1", 10); // 1 retry per model
export const DEFAULT_LLM_STREAMING = process.env.LLM_STREAMING !== "true"; // false by default - STREAMING DISABLED

// CRITICAL: Hard max_tokens limits to prevent infinite generation
// OpenRouter models get slightly higher limits (700 vs 512) for better quality
export const MAX_TOKENS_OPENROUTER = parseInt(process.env.MAX_TOKENS_OPENROUTER || "700", 10);
export const MAX_TOKENS_GROQ = parseInt(process.env.MAX_TOKENS_GROQ || "512", 10);
export const MAX_TOKENS_OLLAMA = parseInt(process.env.MAX_TOKENS_OLLAMA || "384", 10);
export const MAX_TOKENS_CLAUDE = parseInt(process.env.MAX_TOKENS_CLAUDE || "1024", 10);
export const MAX_TOKENS_DEFAULT = parseInt(process.env.MAX_TOKENS_DEFAULT || "700", 10);

// Provider base URLs for OpenAI-compatible APIs
export const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const OLLAMA_DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

// Streaming control: Force-disable for providers that cause hanging
// OpenRouter added to the list - streaming disabled by default for stability
export const STREAMING_DISABLED_PROVIDERS = new Set<string>([
  "openrouter",  // ADDED: OpenRouter streaming disabled for fast, reliable responses
  "groq",
  "ollama",
  "vllm",
  "moonshot",
  "kimi",
]);
