/**
 * Security Integration Index - SUPER SUPREME GOD MODE
 *
 * Exports all integration modules.
 */

// Tool interceptor
export {
  interceptToolCall,
  approveToolExecution,
  denyToolExecution,
  getPendingApprovals,
  isToolExecutionEnabled,
  getSecurityModeStatus,
  type ToolCallRequest,
  type ToolCallDecision,
} from "./tool-interceptor.js";

// Content guard
export {
  guardIncomingContent,
  prepareForLLMContext,
  shouldBlockContent,
  checkRateLimit,
  cleanupRateLimiters,
  logPotentialAttack,
  getAttackLog,
  getAttackStats,
  type GuardedContent,
  type ContentGuardOptions,
  type RateLimitResult,
  type AttackLogEntry,
} from "./content-guard.js";

// Logger middleware
export {
  wrapLogFunction,
  redactLogMessage,
  createSecureLogger,
  isProductionMode,
  shouldLogDebug,
  sanitizeError,
} from "./logger-middleware.js";

// Skill sandbox
export {
  validateSkillManifest,
  hasPermission,
  createSkillExecutionContext,
  canAccessNetwork,
  canAccessFilesystem,
  canExecuteShell,
  canSendMessage,
  canReadMemory,
  canWriteMemory,
  quarantineSkillOutput,
  registerSkillExecution,
  unregisterSkillExecution,
  getActiveSkills,
  terminateAllSkills,
} from "./skill-sandbox.js";
