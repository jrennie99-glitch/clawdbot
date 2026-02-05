/**
 * LLM Router - SUPER SUPREME GOD MODE
 * 
 * Provider-agnostic router supporting multiple LLM providers.
 * Claude is OPTIONAL - system runs securely with open-source models only.
 * 
 * Primary Providers:
 * - Moonshot Kimi (K2.5)
 * - OpenRouter
 * - Local OpenAI-compatible (Ollama/vLLM)
 * 
 * Optional:
 * - Anthropic Claude
 */

import type { LLMProvider, LLMTier, LLMModelConfig, LLMRoutingDecision } from './types.js';

// ============================================================================
// MODEL CATALOG
// ============================================================================

/**
 * Mandatory model configurations.
 * SECURITY: These are the required models - DO NOT substitute.
 */
const MODEL_CATALOG: Record<string, LLMModelConfig> = {
  // GROQ MODELS (PRIMARY - FASTEST)
  'groq-llama-3.1-8b': {
    provider: 'groq',
    modelId: 'llama-3.1-8b-instant',
    tier: 'fast',
    maxTokens: 512,
    contextWindow: 131072,
    costPerMillionTokens: 0.05,
  },
  'groq-llama-3.3-70b': {
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    tier: 'smart',
    maxTokens: 512,
    contextWindow: 131072,
    costPerMillionTokens: 0.59,
  },
  
  // SMART / REASONING TIER
  'deepseek-reasoner': {
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-reasoner',
    tier: 'smart',
    maxTokens: 512,
    contextWindow: 64000,
    costPerMillionTokens: 2.0,
  },
  'qwen-2.5-72b-instruct': {
    provider: 'openrouter',
    modelId: 'qwen/qwen-2.5-72b-instruct',
    tier: 'smart',
    maxTokens: 512,
    contextWindow: 131072,
    costPerMillionTokens: 0.9,
  },
  
  // FAST / GENERAL TIER
  'llama-3.1-70b-instruct': {
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.1-70b-instruct',
    tier: 'fast',
    maxTokens: 512,
    contextWindow: 131072,
    costPerMillionTokens: 0.8,
  },
  'mixtral-8x22b-instruct': {
    provider: 'openrouter',
    modelId: 'mistralai/mixtral-8x22b-instruct',
    tier: 'fast',
    maxTokens: 512,
    contextWindow: 65536,
    costPerMillionTokens: 0.65,
  },
  
  // CHEAP / FALLBACK TIER
  'yi-1.5-34b': {
    provider: 'openrouter',
    modelId: '01-ai/yi-1.5-34b-chat',
    tier: 'cheap',
    maxTokens: 512,
    contextWindow: 16384,
    costPerMillionTokens: 0.3,
  },
  'yi-1.5-9b': {
    provider: 'openrouter',
    modelId: '01-ai/yi-1.5-9b-chat',
    tier: 'cheap',
    maxTokens: 512,
    contextWindow: 16384,
    costPerMillionTokens: 0.1,
  },
  
  // LONG CONTEXT TIER
  'kimi-k2.5': {
    provider: 'moonshot',
    modelId: 'moonshot-v1-128k',
    tier: 'long_context',
    maxTokens: 512,
    contextWindow: 128000,
    costPerMillionTokens: 0.5,
  },
  
  // LOCAL MODELS (Ollama/vLLM)
  'local-llama3': {
    provider: 'ollama',
    modelId: 'llama3',
    tier: 'fast',
    maxTokens: 384,
    contextWindow: 8192,
    costPerMillionTokens: 0, // Free
  },
  'local-mixtral': {
    provider: 'ollama',
    modelId: 'mixtral',
    tier: 'smart',
    maxTokens: 384,
    contextWindow: 32768,
    costPerMillionTokens: 0, // Free
  },
  
  // OPTIONAL: Claude (never required)
  'claude-3.5-sonnet': {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    tier: 'smart',
    maxTokens: 1024,
    contextWindow: 200000,
    costPerMillionTokens: 15.0,
    isOptional: true,
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    tier: 'fast',
    maxTokens: 1024,
    contextWindow: 200000,
    costPerMillionTokens: 0.25,
    isOptional: true,
  },
};

// ============================================================================
// ROUTING CONFIGURATION
// ============================================================================

export type TaskType = 
  | 'planning'
  | 'tool_summary'
  | 'simple_task'
  | 'long_document'
  | 'code_generation'
  | 'general';

const ROUTING_RULES: Record<TaskType, LLMTier[]> = {
  planning: ['smart'],
  tool_summary: ['fast'],
  simple_task: ['cheap'],
  long_document: ['long_context'],
  code_generation: ['smart', 'fast'],
  general: ['fast', 'smart'],
};

const FALLBACK_CHAIN: Record<LLMTier, LLMTier[]> = {
  smart: ['fast', 'cheap'],
  fast: ['cheap', 'smart'],
  cheap: ['fast'],
  long_context: ['fast', 'cheap'],
};

// ============================================================================
// PROVIDER STATUS
// ============================================================================

type ProviderStatus = {
  available: boolean;
  lastCheck: Date;
  lastError?: string;
};

const providerStatus: Record<LLMProvider, ProviderStatus> = {
  groq: { available: false, lastCheck: new Date(0) },
  moonshot: { available: false, lastCheck: new Date(0) },
  openrouter: { available: false, lastCheck: new Date(0) },
  ollama: { available: false, lastCheck: new Date(0) },
  vllm: { available: false, lastCheck: new Date(0) },
  anthropic: { available: false, lastCheck: new Date(0) },
  openai: { available: false, lastCheck: new Date(0) },
  google: { available: false, lastCheck: new Date(0) },
};

/**
 * Checks if a provider is configured and available.
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
  switch (provider) {
    case 'moonshot':
      return !!process.env.MOONSHOT_API_KEY;
    case 'openrouter':
      return !!process.env.OPENROUTER_API_KEY;
    case 'ollama':
      return !!process.env.OLLAMA_HOST || !!process.env.OLLAMA_BASE_URL;
    case 'vllm':
      return !!process.env.VLLM_BASE_URL;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'google':
      return !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY;
    default:
      return false;
  }
}

/**
 * Updates provider status.
 */
export function updateProviderStatus(provider: LLMProvider, available: boolean, error?: string): void {
  providerStatus[provider] = {
    available,
    lastCheck: new Date(),
    lastError: error,
  };
}

/**
 * Gets all available providers.
 */
export function getAvailableProviders(): LLMProvider[] {
  const providers: LLMProvider[] = ['moonshot', 'openrouter', 'ollama', 'vllm', 'anthropic', 'openai', 'google'];
  return providers.filter(p => isProviderAvailable(p));
}

// ============================================================================
// ROUTING LOGIC
// ============================================================================

export type RouteOptions = {
  taskType?: TaskType;
  preferredProvider?: LLMProvider;
  excludeProviders?: LLMProvider[];
  requiredContextWindow?: number;
  maxCostPerMillion?: number;
  preferLocal?: boolean;
};

/**
 * Routes a request to the best available model.
 */
export function routeToModel(options: RouteOptions = {}): LLMRoutingDecision {
  const {
    taskType = 'general',
    preferredProvider,
    excludeProviders = [],
    requiredContextWindow,
    maxCostPerMillion,
    preferLocal = false,
  } = options;
  
  // Get preferred tiers for this task type
  const preferredTiers = ROUTING_RULES[taskType];
  
  // Filter available models
  const availableModels = Object.entries(MODEL_CATALOG)
    .filter(([_, config]) => {
      // Exclude unavailable providers
      if (!isProviderAvailable(config.provider)) return false;
      
      // Exclude explicitly excluded providers
      if (excludeProviders.includes(config.provider)) return false;
      
      // Skip optional models unless their provider is explicitly preferred
      if (config.isOptional && config.provider !== preferredProvider) return false;
      
      // Check context window requirement
      if (requiredContextWindow && config.contextWindow < requiredContextWindow) return false;
      
      // Check cost limit
      if (maxCostPerMillion && config.costPerMillionTokens && config.costPerMillionTokens > maxCostPerMillion) {
        return false;
      }
      
      return true;
    })
    .map(([name, config]) => ({ name, config }));
  
  if (availableModels.length === 0) {
    // Fallback to fail-safe response
    return {
      selectedModel: MODEL_CATALOG['yi-1.5-9b'] ?? MODEL_CATALOG['local-llama3'],
      reason: 'No models available - using fail-safe',
      fallbackChain: [],
      estimatedCost: 0,
    };
  }
  
  // Sort by preference
  availableModels.sort((a, b) => {
    // Prefer local if requested
    if (preferLocal) {
      const aLocal = ['ollama', 'vllm'].includes(a.config.provider);
      const bLocal = ['ollama', 'vllm'].includes(b.config.provider);
      if (aLocal && !bLocal) return -1;
      if (!aLocal && bLocal) return 1;
    }
    
    // Prefer matching tier
    const aTierMatch = preferredTiers.includes(a.config.tier) ? 0 : 1;
    const bTierMatch = preferredTiers.includes(b.config.tier) ? 0 : 1;
    if (aTierMatch !== bTierMatch) return aTierMatch - bTierMatch;
    
    // Prefer preferred provider
    if (preferredProvider) {
      if (a.config.provider === preferredProvider) return -1;
      if (b.config.provider === preferredProvider) return 1;
    }
    
    // Prefer lower cost
    return (a.config.costPerMillionTokens ?? 0) - (b.config.costPerMillionTokens ?? 0);
  });
  
  const selected = availableModels[0];
  
  // Build fallback chain
  const fallbackChain: string[] = [];
  const fallbackTiers = FALLBACK_CHAIN[selected.config.tier] ?? [];
  
  for (const tier of fallbackTiers) {
    const fallback = availableModels.find(
      m => m.config.tier === tier && m.name !== selected.name
    );
    if (fallback) {
      fallbackChain.push(fallback.name);
    }
  }
  
  return {
    selectedModel: selected.config,
    reason: `Selected ${selected.name} for ${taskType} (tier: ${selected.config.tier})`,
    fallbackChain,
    estimatedCost: selected.config.costPerMillionTokens,
  };
}

/**
 * Gets a specific model by name.
 */
export function getModel(name: string): LLMModelConfig | undefined {
  return MODEL_CATALOG[name];
}

/**
 * Gets all models for a tier.
 */
export function getModelsByTier(tier: LLMTier): LLMModelConfig[] {
  return Object.values(MODEL_CATALOG).filter(m => m.tier === tier);
}

/**
 * Gets all models for a provider.
 */
export function getModelsByProvider(provider: LLMProvider): LLMModelConfig[] {
  return Object.values(MODEL_CATALOG).filter(m => m.provider === provider);
}

/**
 * Checks if the system can run without Claude.
 * SECURITY: System MUST be able to run without Claude.
 */
export function canRunWithoutClaude(): boolean {
  const nonClaudeProviders: LLMProvider[] = ['moonshot', 'openrouter', 'ollama', 'vllm', 'openai', 'google'];
  return nonClaudeProviders.some(p => isProviderAvailable(p));
}

/**
 * Gets the recommended model for planning tasks.
 */
export function getReasoningModel(): LLMRoutingDecision {
  return routeToModel({ taskType: 'planning' });
}

/**
 * Gets the recommended model for fast tasks.
 */
export function getFastModel(): LLMRoutingDecision {
  return routeToModel({ taskType: 'tool_summary' });
}

/**
 * Gets the recommended model for cheap/fallback tasks.
 */
export function getCheapModel(): LLMRoutingDecision {
  return routeToModel({ taskType: 'simple_task' });
}

/**
 * Gets the recommended model for long documents.
 */
export function getLongContextModel(): LLMRoutingDecision {
  return routeToModel({ taskType: 'long_document' });
}

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export type ProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
};

/**
 * Gets configuration for a provider.
 */
export function getProviderConfig(provider: LLMProvider): ProviderConfig | null {
  switch (provider) {
    case 'moonshot':
      if (!process.env.MOONSHOT_API_KEY) return null;
      return {
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKey: process.env.MOONSHOT_API_KEY,
      };
      
    case 'openrouter':
      if (!process.env.OPENROUTER_API_KEY) return null;
      return {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: {
          'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://moltbot.local',
          'X-Title': 'Moltbot',
        },
      };
      
    case 'ollama':
      const ollamaHost = process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
      return {
        baseUrl: ollamaHost,
      };
      
    case 'vllm':
      if (!process.env.VLLM_BASE_URL) return null;
      return {
        baseUrl: process.env.VLLM_BASE_URL,
        apiKey: process.env.VLLM_API_KEY,
      };
      
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) return null;
      return {
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
      
    case 'openai':
      if (!process.env.OPENAI_API_KEY) return null;
      return {
        baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
      };
      
    case 'google':
      const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
      if (!googleKey) return null;
      return {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: googleKey,
      };
      
    default:
      return null;
  }
}
