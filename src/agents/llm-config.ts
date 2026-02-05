/**
 * LLM Configuration Module
 * 
 * Centralizes LLM provider configuration with support for:
 * - Multiple providers (Groq, OpenRouter, Ollama, Anthropic)
 * - Hard timeouts to prevent stuck requests
 * - Non-streaming mode for reliability
 * - Provider failover
 */

import {
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_LLM_MAX_RETRIES,
  DEFAULT_LLM_STREAMING,
  GROQ_BASE_URL,
  OPENROUTER_BASE_URL,
  OLLAMA_DEFAULT_BASE_URL,
} from "./defaults.js";

export type LLMProviderStatus = {
  name: string;
  configured: boolean;
  baseUrl?: string;
  error?: string;
};

export type LLMConfig = {
  timeoutMs: number;
  maxRetries: number;
  streaming: boolean;
  providers: LLMProviderStatus[];
};

/**
 * Check if a provider is configured (has required env vars)
 */
export function isProviderConfigured(provider: string): boolean {
  const normalized = provider.toLowerCase().trim();
  
  switch (normalized) {
    case "groq":
      return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim());
    case "openrouter":
      return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
    case "ollama":
      return Boolean(process.env.OLLAMA_BASE_URL?.trim() && process.env.OLLAMA_MODEL?.trim());
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case "google":
      return Boolean(process.env.GOOGLE_API_KEY?.trim());
    case "moonshot":
    case "kimi":
      return Boolean(process.env.MOONSHOT_API_KEY?.trim() || process.env.KIMI_API_KEY?.trim());
    default:
      return false;
  }
}

/**
 * Get the base URL for a provider
 */
export function getProviderBaseUrl(provider: string): string | undefined {
  const normalized = provider.toLowerCase().trim();
  
  switch (normalized) {
    case "groq":
      return process.env.OPENAI_BASE_URL?.trim() || GROQ_BASE_URL;
    case "openrouter":
      return process.env.OPENAI_BASE_URL?.trim() || OPENROUTER_BASE_URL;
    case "ollama":
      return process.env.OLLAMA_BASE_URL?.trim() || OLLAMA_DEFAULT_BASE_URL;
    default:
      return process.env.OPENAI_BASE_URL?.trim() || undefined;
  }
}

/**
 * Get API key for a provider
 */
export function getProviderApiKey(provider: string): string | undefined {
  const normalized = provider.toLowerCase().trim();
  
  switch (normalized) {
    case "groq":
      return process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    case "openrouter":
      return process.env.OPENROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY?.trim();
    case "openai":
      return process.env.OPENAI_API_KEY?.trim();
    case "google":
      return process.env.GOOGLE_API_KEY?.trim();
    case "moonshot":
    case "kimi":
      return process.env.MOONSHOT_API_KEY?.trim() || process.env.KIMI_API_KEY?.trim();
    case "ollama":
      return "ollama"; // Ollama doesn't require API key
    default:
      return process.env.OPENAI_API_KEY?.trim();
  }
}

/**
 * Get full LLM configuration including all provider statuses
 */
export function getLLMConfig(): LLMConfig {
  const providers: LLMProviderStatus[] = [
    {
      name: "groq",
      configured: isProviderConfigured("groq"),
      baseUrl: GROQ_BASE_URL,
    },
    {
      name: "openrouter",
      configured: isProviderConfigured("openrouter"),
      baseUrl: OPENROUTER_BASE_URL,
    },
    {
      name: "ollama",
      configured: isProviderConfigured("ollama"),
      baseUrl: process.env.OLLAMA_BASE_URL?.trim() || OLLAMA_DEFAULT_BASE_URL,
      error: !process.env.OLLAMA_MODEL?.trim() ? "Missing OLLAMA_MODEL" : undefined,
    },
    {
      name: "anthropic",
      configured: isProviderConfigured("anthropic"),
    },
    {
      name: "openai",
      configured: isProviderConfigured("openai"),
      baseUrl: process.env.OPENAI_BASE_URL?.trim(),
    },
    {
      name: "google",
      configured: isProviderConfigured("google"),
    },
    {
      name: "moonshot",
      configured: isProviderConfigured("moonshot"),
    },
  ];

  return {
    timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
    maxRetries: DEFAULT_LLM_MAX_RETRIES,
    streaming: DEFAULT_LLM_STREAMING,
    providers,
  };
}

/**
 * Get list of configured providers in priority order
 */
export function getConfiguredProviders(): string[] {
  const priority = ["groq", "openrouter", "ollama", "openai", "anthropic", "google", "moonshot"];
  return priority.filter(isProviderConfigured);
}

/**
 * Check if Ollama is reachable
 */
export async function checkOllamaStatus(): Promise<{ online: boolean; error?: string }> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) {
    return { online: false, error: "OLLAMA_BASE_URL not set" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${baseUrl.replace(/\/v1$/, "")}/api/tags`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { online: false, error: `HTTP ${response.status}` };
    }
    
    return { online: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      return { online: false, error: "Connection timeout" };
    }
    return { online: false, error: message };
  }
}

/**
 * Format a user-friendly error message for provider errors
 */
export function formatProviderError(params: {
  provider: string;
  status?: number;
  message?: string;
}): string {
  const { provider, status, message } = params;
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  
  // Handle common error cases with user-friendly messages
  if (status === 401) {
    return `${providerName}: Missing or invalid API key. Check your ${provider.toUpperCase()}_API_KEY.`;
  }
  if (status === 404) {
    return `${providerName}: Model not found. Check model ID in your config.`;
  }
  if (status === 429) {
    return `${providerName}: Rate limited. Wait a moment and try again.`;
  }
  if (status === 402) {
    return `${providerName}: Billing/quota issue. Check your account balance.`;
  }
  if (status === 500 || status === 502 || status === 503) {
    return `${providerName}: Server error (${status}). Try again or switch providers.`;
  }
  if (status === 408 || message?.toLowerCase().includes("timeout")) {
    return `${providerName}: Request timed out. Try a faster model or check your connection.`;
  }
  
  // Generic error with message
  if (message) {
    const shortMessage = message.length > 100 ? message.slice(0, 100) + "..." : message;
    return `${providerName} error: ${shortMessage}`;
  }
  
  return `${providerName}: Request failed (${status || "unknown error"}).`;
}
