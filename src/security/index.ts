/**
 * Security Index - SUPER SUPREME GOD MODE
 * 
 * Main export for all security modules.
 */

// Types
export * from './types.js';

// Core utilities
export * from './utils.js';

// Trust zones
export {
  quarantineContent,
  resolveTrustLevel,
  getQuarantinedContent,
  cleanupQuarantine,
  prepareForReasoning,
  validateReasoningInput,
  validateToolCallOrigin,
  createMemoryProvenance,
  isMemoryTrustedForPlanning,
  getMemoryProvenance,
  cleanupMemoryProvenance,
  type QuarantineEntry,
  type ReasoningInput,
} from './trust-zones.js';

// Content sanitization
export {
  sanitizeContent,
  sanitizeContentWithDetails,
  detectInjectionPatterns,
  wrapExternalContent,
  hasSuspiciousPatterns,
  getInjectionSeverity,
  type SanitizeOptions,
  type SanitizeResult,
} from './content-sanitizer.js';

// Secret redaction
export {
  redactSecrets,
  containsSecrets,
  getSecretSeverity,
  createRedactionMiddleware,
  redactEnvVars,
  safeStringify,
} from './secret-redaction.js';

// Policy engine
export {
  evaluatePolicy,
  wouldDeny,
  wouldRequireConfirmation,
  createActionPreview,
  approveActionPreview,
  denyActionPreview,
  isPreviewApproved,
  getActionPreview,
  cleanupExpiredPreviews,
  addPolicyRule,
  getPolicyRules,
} from './policy-engine.js';

// Kill switch & lockdown
export {
  getKillSwitchState,
  activateKillSwitch,
  deactivateKillSwitch,
  isKillSwitchActive,
  getLockdownConfig,
  enableLockdownMode,
  disableLockdownMode,
  isLockdownModeEnabled,
  addToLockdownAllowlist,
  removeFromLockdownAllowlist,
  getSecurityStatus,
  initializeSecurityControls,
} from './kill-switch.js';

// LLM router
export {
  isProviderAvailable,
  updateProviderStatus,
  getAvailableProviders,
  routeToModel,
  getModel,
  getModelsByTier,
  getModelsByProvider,
  canRunWithoutClaude,
  getReasoningModel,
  getFastModel,
  getCheapModel,
  getLongContextModel,
  getProviderConfig,
  type TaskType,
  type RouteOptions,
  type ProviderConfig,
} from './llm-router.js';

// Cost controls
export {
  getBudget,
  setBudget,
  resetBudget,
  getUsage,
  recordTokenUsage,
  recordToolCall,
  resetRunUsage,
  checkBudgetStatus,
  wouldExceedBudget,
  estimateCost,
  estimateTokens,
  getOptimizationSuggestions,
  getBudgetBasedTier,
  shouldUseCache,
  type BudgetStatus,
  type OptimizationSuggestion,
} from './cost-controls.js';
