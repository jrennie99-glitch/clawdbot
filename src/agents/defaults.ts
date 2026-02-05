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
export const DEFAULT_LLM_TIMEOUT_MS = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || "15000", 10);
export const DEFAULT_LLM_MAX_RETRIES = parseInt(process.env.LLM_MAX_RETRIES || "1", 10);
export const DEFAULT_LLM_STREAMING = process.env.LLM_STREAMING !== "true"; // false by default

// Provider base URLs for OpenAI-compatible APIs
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OLLAMA_DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
