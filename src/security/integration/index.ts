/**
 * Security Integration Index - SUPER SUPREME GOD MODE
 *
 * Exports all integration modules.
 */

// Security initialization
export { initializeSecurity, isSecurityInitialized, resetSecurityInit } from "./security-init.js";

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

// Exec wrapper
export {
  checkToolExecution,
  validateCommandForSSRF,
  validateCommandForExfiltration,
  validateExecCommand,
  type ExecSecurityResult,
} from "./exec-wrapper.js";

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

// Rate limiter runtime
export {
  checkMessageRateLimit,
  checkToolCallRateLimit,
  checkLLMCallRateLimit,
  resetRunToolCallCount,
  getRunToolCallCount,
  cleanupRateLimiters as cleanupRateLimiterMaps,
  getRateLimiterStatus,
  type RateLimitDecision,
} from "./rate-limiter.js";

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
