/**
 * Provider status and testing endpoints for the gateway
 */

import {
  getLLMConfig,
  checkOllamaStatus,
  isProviderConfigured,
  getProviderApiKey,
  getProviderBaseUrl,
  formatProviderError,
} from "../../agents/llm-config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

type ProviderTestResult = {
  provider: string;
  success: boolean;
  latencyMs?: number;
  error?: string;
};

/**
 * Test a single provider with a simple prompt
 */
async function testProvider(provider: string): Promise<ProviderTestResult> {
  const startTime = Date.now();
  
  if (!isProviderConfigured(provider)) {
    return {
      provider,
      success: false,
      error: "Not configured (missing API key or base URL)",
    };
  }

  // Special handling for Ollama - check if it's reachable first
  if (provider === "ollama") {
    const status = await checkOllamaStatus();
    if (!status.online) {
      return {
        provider,
        success: false,
        error: status.error || "Ollama offline",
      };
    }
  }

  try {
    const apiKey = getProviderApiKey(provider);
    const baseUrl = getProviderBaseUrl(provider);
    
    // Use a minimal test prompt
    const testPayload = {
      model: getTestModel(provider),
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 5,
      stream: false,
    };

    const url = provider === "anthropic"
      ? "https://api.anthropic.com/v1/messages"
      : `${baseUrl}/chat/completions`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey || "";
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Hard timeout of 10 seconds for test
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      
      return {
        provider,
        success: false,
        latencyMs,
        error: formatProviderError({
          provider,
          status: response.status,
          message: errorMessage,
        }),
      };
    }

    return {
      provider,
      success: true,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    
    if (message.includes("abort")) {
      return {
        provider,
        success: false,
        latencyMs,
        error: formatProviderError({ provider, message: "Request timed out (10s)" }),
      };
    }
    
    return {
      provider,
      success: false,
      latencyMs,
      error: formatProviderError({ provider, message }),
    };
  }
}

/**
 * Get test model for a provider
 */
function getTestModel(provider: string): string {
  switch (provider.toLowerCase()) {
    case "groq":
      return process.env.DEFAULT_MODEL || "llama-3.1-8b-instant";
    case "openrouter":
      return "meta-llama/llama-3.1-8b-instruct";
    case "ollama":
      return process.env.OLLAMA_MODEL || "llama3";
    case "anthropic":
      return "claude-3-haiku-20240307";
    case "openai":
      return "gpt-3.5-turbo";
    case "google":
      return "gemini-pro";
    case "moonshot":
      return "moonshot-v1-8k";
    default:
      return "gpt-3.5-turbo";
  }
}

export const providersHandlers: GatewayRequestHandlers = {
  /**
   * Get provider status - which providers are configured
   */
  "providers.status": async ({ respond }) => {
    try {
      const config = getLLMConfig();
      
      // Also check Ollama connectivity if configured
      const ollamaProvider = config.providers.find(p => p.name === "ollama");
      if (ollamaProvider?.configured) {
        const ollamaStatus = await checkOllamaStatus();
        if (!ollamaStatus.online) {
          ollamaProvider.error = ollamaStatus.error || "Ollama offline";
        }
      }
      
      respond(true, {
        streaming: config.streaming,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        providers: config.providers,
        configuredCount: config.providers.filter(p => p.configured).length,
      }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Test configured providers with a simple prompt
   */
  "providers.test": async ({ respond, params }) => {
    try {
      const config = getLLMConfig();
      const configuredProviders = config.providers
        .filter(p => p.configured)
        .map(p => p.name);

      // Allow testing specific provider(s)
      const requestedProviders = params?.providers;
      const providersToTest = Array.isArray(requestedProviders) && requestedProviders.length > 0
        ? requestedProviders.filter((p: string) => typeof p === "string")
        : configuredProviders;

      if (providersToTest.length === 0) {
        respond(true, {
          results: [],
          summary: "No providers configured. Set API keys in environment variables.",
        }, undefined);
        return;
      }

      // Test all providers in parallel with individual timeouts
      const results = await Promise.all(
        providersToTest.map((provider: string) => testProvider(provider))
      );

      const passed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      respond(true, {
        results,
        summary: `${passed} passed, ${failed} failed`,
        fastestProvider: results
          .filter(r => r.success && r.latencyMs)
          .sort((a, b) => (a.latencyMs || 0) - (b.latencyMs || 0))[0]?.provider,
      }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
