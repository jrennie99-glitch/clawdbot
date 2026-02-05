/**
 * Security Types - SUPER SUPREME GOD MODE
 * Core type definitions for the security infrastructure
 */

// ============================================================================
// TRUST ZONES
// ============================================================================

export type TrustZone = 'untrusted' | 'reasoning' | 'execution';

export type ContentSource = 
  | 'owner'
  | 'paired'
  | 'unpaired'
  | 'web'
  | 'document'
  | 'skill'
  | 'system'
  | 'email'
  | 'webhook'
  | 'api';

export type TrustLevel = 'high' | 'medium' | 'low' | 'untrusted';

// ============================================================================
// POLICY ENGINE
// ============================================================================

export type PolicyDecision = 'allow' | 'require_confirmation' | 'deny';

export type PolicyContext = {
  /** Who is making the request */
  who: {
    userId?: string;
    role?: UserRole;
    pairingStatus?: PairingStatus;
    sessionKey?: string;
    agentId?: string;
  };
  /** What action is being requested */
  what: {
    tool: string;
    action?: string;
    parameters?: Record<string, unknown>;
  };
  /** Where the action targets */
  where: {
    domain?: string;
    ip?: string;
    filePath?: string;
    channel?: string;
    url?: string;
  };
  /** Risk assessment */
  risk: {
    isDestructive?: boolean;
    isExternal?: boolean;
    accessesSecrets?: boolean;
    modifiesConfig?: boolean;
    sendsData?: boolean;
  };
  /** Budget tracking */
  budget: {
    tokensUsed?: number;
    tokensLimit?: number;
    toolCallsUsed?: number;
    toolCallsLimit?: number;
    costUsd?: number;
    costLimitUsd?: number;
  };
};

export type PolicyEvaluationResult = {
  decision: PolicyDecision;
  reason: string;
  ruleId?: string;
  requiresPreview?: boolean;
  previewMessage?: string;
  metadata?: Record<string, unknown>;
};

export type PolicyRule = {
  id: string;
  name: string;
  description?: string;
  priority: number;
  condition: (ctx: PolicyContext) => boolean;
  decision: PolicyDecision;
  reason: string;
  requiresPreview?: boolean;
  previewTemplate?: string;
};

// ============================================================================
// USER & PAIRING
// ============================================================================

export type UserRole = 'owner' | 'admin' | 'user' | 'guest' | 'anonymous';

export type PairingStatus = 'owner' | 'paired' | 'pending' | 'unpaired' | 'blocked';

// ============================================================================
// MEMORY PROVENANCE
// ============================================================================

export type MemoryProvenance = {
  id: string;
  sourceType: ContentSource;
  trustLevel: TrustLevel;
  createdAt: Date;
  expiresAt?: Date;
  contentHash: string;
  metadata?: {
    sender?: string;
    channel?: string;
    sessionKey?: string;
    sanitized?: boolean;
  };
};

export type QuarantinedMemory = MemoryProvenance & {
  rawContent: string;
  sanitizedContent?: string;
  quarantinedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  approved?: boolean;
};

// ============================================================================
// SKILL/PLUGIN SECURITY
// ============================================================================

export type SkillPermission = 
  | 'network'
  | 'filesystem'
  | 'shell'
  | 'browser'
  | 'memory_read'
  | 'memory_write'
  | 'send_message'
  | 'schedule'
  | 'config_read'
  | 'config_write';

export type SkillManifest = {
  id: string;
  name: string;
  version: string;
  permissions: SkillPermission[];
  sandboxed: boolean;
  trustedSource?: boolean;
  integrityHash?: string;
};

export type SkillExecutionContext = {
  skillId: string;
  manifest: SkillManifest;
  sandboxId?: string;
  timeout: number;
  memoryQuota: number;
  networkAllowlist?: string[];
};

// ============================================================================
// SECRET REDACTION
// ============================================================================

export type SecretPattern = {
  name: string;
  pattern: RegExp;
  replacement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

export type RedactionResult = {
  original: string;
  redacted: string;
  secretsFound: Array<{
    pattern: string;
    count: number;
    severity: SecretPattern['severity'];
  }>;
  wasRedacted: boolean;
};

// ============================================================================
// LLM ROUTER
// ============================================================================

export type LLMProvider = 
  | 'groq'
  | 'moonshot'
  | 'openrouter'
  | 'ollama'
  | 'vllm'
  | 'anthropic'
  | 'openai'
  | 'google';

export type LLMTier = 'smart' | 'fast' | 'cheap' | 'long_context';

export type LLMModelConfig = {
  provider: LLMProvider;
  modelId: string;
  tier: LLMTier;
  maxTokens: number;
  contextWindow: number;
  costPerMillionTokens?: number;
  isOptional?: boolean;
  fallbackTo?: string;
};

export type LLMRoutingDecision = {
  selectedModel: LLMModelConfig;
  reason: string;
  fallbackChain: string[];
  estimatedCost?: number;
};

// ============================================================================
// COST CONTROLS
// ============================================================================

export type CostBudget = {
  dailyLimitUsd: number;
  perRunLimitUsd: number;
  tokensPerRunLimit: number;
  toolCallsPerRunLimit: number;
  warningThreshold: number; // 0-1
};

export type CostUsage = {
  dailyUsageUsd: number;
  runUsageUsd: number;
  tokensUsed: number;
  toolCallsUsed: number;
  lastResetDate: string;
};

// ============================================================================
// LOCKDOWN & KILL SWITCH
// ============================================================================

export type LockdownConfig = {
  enabled: boolean;
  externalCommsConfirm: boolean;
  writesDeletesConfirm: boolean;
  shellBrowserDeny: boolean;
  outboundNetworkAllowlist: string[];
};

export type KillSwitchState = {
  enabled: boolean;
  activatedAt?: Date;
  activatedBy?: string;
  reason?: string;
};

// ============================================================================
// ACTION PREVIEW
// ============================================================================

export type ActionPreview = {
  id: string;
  tool: string;
  action: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impacts: string[];
  reversible: boolean;
  requiresConfirmation: boolean;
  timeout: number;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedBy?: string;
  approvedAt?: Date;
};

// ============================================================================
// AUDIT LOG
// ============================================================================

export type AuditLogEntry = {
  id: string;
  timestamp: Date;
  eventType: string;
  actor?: {
    userId?: string;
    role?: UserRole;
    sessionKey?: string;
  };
  resource?: {
    type: string;
    id?: string;
  };
  action: string;
  result: 'success' | 'failure' | 'blocked';
  reason?: string;
  metadata?: Record<string, unknown>;
  // Never include secrets in audit logs
};
