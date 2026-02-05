// Defaults for agent metadata when upstream does not supply them.
// Default to cheaper/faster providers that work reliably without Claude.
// Users can override via env vars or moltbot.json.

// Provider priority: groq -> openrouter -> ollama -> anthropic (fallback only)
export const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER?.trim() || "groq";
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL?.trim() || "llama-3.1-8b-instant";

// Context window: Use conservative defaults for cheaper models.
// Groq's llama-3.1-8b-instant has 128k context but we use less for speed.
export const DEFAULT_CONTEXT_TOKENS = 32_000;

// LLM request configuration (can be overridden via env vars)
// CRITICAL: Hard timeouts to prevent hanging on cheap models
export const DEFAULT_CONNECTION_TIMEOUT_MS = parseInt(process.env.LLM_CONNECTION_TIMEOUT_MS || "5000", 10); // 5s connection timeout
export const DEFAULT_LLM_TIMEOUT_MS = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || "12000", 10); // 12s total request timeout
export const DEFAULT_LLM_MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES || "1", 10);
export const DEFAULT_LLM_STREAMING = process.env.LLM_STREAMING !== "true"; // false by default - STREAMING DISABLED

// CRITICAL: Hard max_tokens limits to prevent infinite generation
// These MUST be enforced for all cheap models to prevent hanging
export const MAX_TOKENS_GROQ = parseInt(process.env.MAX_TOKENS_GROQ || "512", 10);
export const MAX_TOKENS_OPENROUTER = parseInt(process.env.MAX_TOKENS_OPENROUTER || "512", 10);
export const MAX_TOKENS_OLLAMA = parseInt(process.env.MAX_TOKENS_OLLAMA || "384", 10);
export const MAX_TOKENS_CLAUDE = parseInt(process.env.MAX_TOKENS_CLAUDE || "1024", 10);
export const MAX_TOKENS_DEFAULT = parseInt(process.env.MAX_TOKENS_DEFAULT || "512", 10);

// Provider base URLs for OpenAI-compatible APIs
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OLLAMA_DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

// Streaming control: Force-disable for providers that cause hanging
export const STREAMING_DISABLED_PROVIDERS = new Set<string>([
  "groq",
  "openrouter", 
  "ollama",
  "vllm",
  "moonshot",
  "kimi",
]);
