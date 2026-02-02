/**
 * Cost Controls - SUPER SUPREME GOD MODE
 * 
 * Budget management and cost optimization for LLM usage.
 */

import type { CostBudget, CostUsage } from './types.js';
import { nowIso } from './utils.js';

// ============================================================================
// BUDGET CONFIGURATION
// ============================================================================

const DEFAULT_BUDGET: CostBudget = {
  dailyLimitUsd: parseFloat(process.env.DAILY_COST_LIMIT_USD ?? '10'),
  perRunLimitUsd: parseFloat(process.env.PER_RUN_COST_LIMIT_USD ?? '1'),
  tokensPerRunLimit: parseInt(process.env.TOKENS_PER_RUN_LIMIT ?? '100000', 10),
  toolCallsPerRunLimit: parseInt(process.env.TOOL_CALLS_PER_RUN_LIMIT ?? '100', 10),
  warningThreshold: 0.8,
};

let currentBudget: CostBudget = { ...DEFAULT_BUDGET };

let usage: CostUsage = {
  dailyUsageUsd: 0,
  runUsageUsd: 0,
  tokensUsed: 0,
  toolCallsUsed: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
};

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * Gets the current budget configuration.
 */
export function getBudget(): CostBudget {
  return { ...currentBudget };
}

/**
 * Sets budget limits.
 */
export function setBudget(budget: Partial<CostBudget>): void {
  currentBudget = {
    ...currentBudget,
    ...budget,
  };
}

/**
 * Resets budget to defaults.
 */
export function resetBudget(): void {
  currentBudget = { ...DEFAULT_BUDGET };
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Gets current usage.
 */
export function getUsage(): CostUsage {
  maybeResetDaily();
  return { ...usage };
}

/**
 * Records token usage.
 */
export function recordTokenUsage(tokens: number, costUsd: number): void {
  maybeResetDaily();
  
  usage.tokensUsed += tokens;
  usage.runUsageUsd += costUsd;
  usage.dailyUsageUsd += costUsd;
}

/**
 * Records a tool call.
 */
export function recordToolCall(): void {
  maybeResetDaily();
  usage.toolCallsUsed += 1;
}

/**
 * Resets run-level usage (call at start of each run).
 */
export function resetRunUsage(): void {
  usage.runUsageUsd = 0;
  usage.tokensUsed = 0;
  usage.toolCallsUsed = 0;
}

/**
 * Resets daily usage if it's a new day.
 */
function maybeResetDaily(): void {
  const today = new Date().toISOString().split('T')[0];
  if (usage.lastResetDate !== today) {
    usage.dailyUsageUsd = 0;
    usage.lastResetDate = today;
  }
}

// ============================================================================
// BUDGET CHECKS
// ============================================================================

export type BudgetStatus = {
  withinBudget: boolean;
  dailyRemaining: number;
  runRemaining: number;
  tokensRemaining: number;
  toolCallsRemaining: number;
  warnings: string[];
};

/**
 * Checks current budget status.
 */
export function checkBudgetStatus(): BudgetStatus {
  maybeResetDaily();
  
  const dailyRemaining = currentBudget.dailyLimitUsd - usage.dailyUsageUsd;
  const runRemaining = currentBudget.perRunLimitUsd - usage.runUsageUsd;
  const tokensRemaining = currentBudget.tokensPerRunLimit - usage.tokensUsed;
  const toolCallsRemaining = currentBudget.toolCallsPerRunLimit - usage.toolCallsUsed;
  
  const warnings: string[] = [];
  
  // Check daily budget
  if (dailyRemaining <= 0) {
    warnings.push('Daily budget exceeded');
  } else if (usage.dailyUsageUsd >= currentBudget.dailyLimitUsd * currentBudget.warningThreshold) {
    warnings.push(`Daily budget at ${Math.round(usage.dailyUsageUsd / currentBudget.dailyLimitUsd * 100)}%`);
  }
  
  // Check run budget
  if (runRemaining <= 0) {
    warnings.push('Per-run budget exceeded');
  } else if (usage.runUsageUsd >= currentBudget.perRunLimitUsd * currentBudget.warningThreshold) {
    warnings.push(`Run budget at ${Math.round(usage.runUsageUsd / currentBudget.perRunLimitUsd * 100)}%`);
  }
  
  // Check tokens
  if (tokensRemaining <= 0) {
    warnings.push('Token limit exceeded');
  }
  
  // Check tool calls
  if (toolCallsRemaining <= 0) {
    warnings.push('Tool call limit exceeded');
  }
  
  return {
    withinBudget: dailyRemaining > 0 && runRemaining > 0 && tokensRemaining > 0 && toolCallsRemaining > 0,
    dailyRemaining,
    runRemaining,
    tokensRemaining,
    toolCallsRemaining,
    warnings,
  };
}

/**
 * Checks if a request would exceed budget.
 */
export function wouldExceedBudget(estimatedTokens: number, estimatedCostUsd: number): boolean {
  maybeResetDaily();
  
  if (usage.dailyUsageUsd + estimatedCostUsd > currentBudget.dailyLimitUsd) return true;
  if (usage.runUsageUsd + estimatedCostUsd > currentBudget.perRunLimitUsd) return true;
  if (usage.tokensUsed + estimatedTokens > currentBudget.tokensPerRunLimit) return true;
  
  return false;
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Estimates cost for a request.
 */
export function estimateCost(tokens: number, costPerMillion: number): number {
  return (tokens / 1_000_000) * costPerMillion;
}

/**
 * Estimates tokens from text (rough approximation).
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

// ============================================================================
// COST OPTIMIZATION
// ============================================================================

export type OptimizationSuggestion = {
  type: 'downgrade_model' | 'compact_prompt' | 'batch_requests' | 'use_cache';
  description: string;
  estimatedSavings: number;
};

/**
 * Gets cost optimization suggestions based on usage.
 */
export function getOptimizationSuggestions(): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const status = checkBudgetStatus();
  
  if (status.dailyRemaining < currentBudget.dailyLimitUsd * 0.5) {
    suggestions.push({
      type: 'downgrade_model',
      description: 'Consider using cheaper models for simple tasks',
      estimatedSavings: 0.3,
    });
  }
  
  if (usage.tokensUsed > currentBudget.tokensPerRunLimit * 0.5) {
    suggestions.push({
      type: 'compact_prompt',
      description: 'Prompt compaction could reduce token usage',
      estimatedSavings: 0.2,
    });
  }
  
  if (usage.toolCallsUsed > 10) {
    suggestions.push({
      type: 'batch_requests',
      description: 'Batching tool calls could improve efficiency',
      estimatedSavings: 0.15,
    });
  }
  
  return suggestions;
}

// ============================================================================
// GRACEFUL DEGRADATION
// ============================================================================

/**
 * Gets the tier to use based on remaining budget.
 */
export function getBudgetBasedTier(): 'smart' | 'fast' | 'cheap' {
  const status = checkBudgetStatus();
  
  // If plenty of budget, use smart tier
  if (status.dailyRemaining > currentBudget.dailyLimitUsd * 0.5) {
    return 'smart';
  }
  
  // If moderate budget, use fast tier
  if (status.dailyRemaining > currentBudget.dailyLimitUsd * 0.2) {
    return 'fast';
  }
  
  // If low budget, use cheap tier
  return 'cheap';
}

/**
 * Checks if should use cached response.
 */
export function shouldUseCache(): boolean {
  const status = checkBudgetStatus();
  return status.dailyRemaining < currentBudget.dailyLimitUsd * 0.3;
}
