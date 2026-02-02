/**
 * Budget Guardrails - SUPER SUPREME GOD MODE
 *
 * Per-org/per-user enforceable cost limits.
 */

// ============================================================================
// TYPES
// ============================================================================

export type BudgetPeriod = "run" | "daily" | "monthly";

export type BudgetConfig = {
  perRunLimitUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  warningThreshold: number; // 0-1, default 0.7
  autoDowngrade: boolean; // Auto-downgrade model tier when near limit
  hardStop: boolean; // Hard stop when limit exceeded
};

export type BudgetUsage = {
  runUsageUsd: number;
  dailyUsageUsd: number;
  monthlyUsageUsd: number;
  lastResetDaily: string;
  lastResetMonthly: string;
};

export type BudgetViolation = {
  timestamp: string;
  userId?: string;
  orgId?: string;
  period: BudgetPeriod;
  limitUsd: number;
  usageUsd: number;
  action: "warn" | "downgrade" | "block";
  reason: string;
};

export type BudgetStatus = {
  withinBudget: boolean;
  warnings: string[];
  currentTier: "smart" | "fast" | "cheap" | "blocked";
  usage: {
    run: { used: number; limit: number; percent: number };
    daily: { used: number; limit: number; percent: number };
    monthly: { used: number; limit: number; percent: number };
  };
};

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: BudgetConfig = {
  perRunLimitUsd: parseFloat(process.env.PER_RUN_COST_LIMIT_USD ?? "1"),
  dailyLimitUsd: parseFloat(process.env.DAILY_COST_LIMIT_USD ?? "10"),
  monthlyLimitUsd: parseFloat(process.env.MONTHLY_COST_LIMIT_USD ?? "100"),
  warningThreshold: parseFloat(process.env.BUDGET_WARNING_THRESHOLD ?? "0.7"),
  autoDowngrade: process.env.BUDGET_AUTO_DOWNGRADE !== "false",
  hardStop: process.env.BUDGET_HARD_STOP !== "false",
};

// ============================================================================
// STATE
// ============================================================================

// Per-user/org configs
const userConfigs = new Map<string, BudgetConfig>();
const orgConfigs = new Map<string, BudgetConfig>();

// Per-user/org usage
const userUsage = new Map<string, BudgetUsage>();
const orgUsage = new Map<string, BudgetUsage>();

// Global usage (fallback)
let globalUsage: BudgetUsage = {
  runUsageUsd: 0,
  dailyUsageUsd: 0,
  monthlyUsageUsd: 0,
  lastResetDaily: new Date().toISOString().split("T")[0]!,
  lastResetMonthly: new Date().toISOString().slice(0, 7),
};

// Violations log
const violations: BudgetViolation[] = [];
const MAX_VIOLATIONS = 1000;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Sets budget config for a user.
 */
export function setUserBudgetConfig(userId: string, config: Partial<BudgetConfig>): void {
  const existing = userConfigs.get(userId) ?? { ...DEFAULT_CONFIG };
  userConfigs.set(userId, { ...existing, ...config });
}

/**
 * Sets budget config for an org.
 */
export function setOrgBudgetConfig(orgId: string, config: Partial<BudgetConfig>): void {
  const existing = orgConfigs.get(orgId) ?? { ...DEFAULT_CONFIG };
  orgConfigs.set(orgId, { ...existing, ...config });
}

/**
 * Gets effective budget config for a user/org.
 */
export function getBudgetConfig(params: { userId?: string; orgId?: string }): BudgetConfig {
  // User config takes precedence
  if (params.userId && userConfigs.has(params.userId)) {
    return userConfigs.get(params.userId)!;
  }
  // Org config next
  if (params.orgId && orgConfigs.has(params.orgId)) {
    return orgConfigs.get(params.orgId)!;
  }
  // Default
  return DEFAULT_CONFIG;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

function getUsage(params: { userId?: string; orgId?: string }): BudgetUsage {
  const today = new Date().toISOString().split("T")[0]!;
  const thisMonth = new Date().toISOString().slice(0, 7);

  let usage: BudgetUsage;

  if (params.userId && userUsage.has(params.userId)) {
    usage = userUsage.get(params.userId)!;
  } else if (params.orgId && orgUsage.has(params.orgId)) {
    usage = orgUsage.get(params.orgId)!;
  } else {
    usage = { ...globalUsage };
  }

  // Reset daily if new day
  if (usage.lastResetDaily !== today) {
    usage.dailyUsageUsd = 0;
    usage.lastResetDaily = today;
  }

  // Reset monthly if new month
  if (usage.lastResetMonthly !== thisMonth) {
    usage.monthlyUsageUsd = 0;
    usage.lastResetMonthly = thisMonth;
  }

  return usage;
}

function setUsage(params: { userId?: string; orgId?: string }, usage: BudgetUsage): void {
  if (params.userId) {
    userUsage.set(params.userId, usage);
  } else if (params.orgId) {
    orgUsage.set(params.orgId, usage);
  } else {
    globalUsage = usage;
  }
}

/**
 * Records cost usage.
 */
export function recordCostUsage(params: {
  userId?: string;
  orgId?: string;
  costUsd: number;
}): void {
  const usage = getUsage(params);
  usage.runUsageUsd += params.costUsd;
  usage.dailyUsageUsd += params.costUsd;
  usage.monthlyUsageUsd += params.costUsd;
  setUsage(params, usage);
}

/**
 * Resets run-level usage. Call at start of each run.
 */
export function resetRunUsage(params: { userId?: string; orgId?: string }): void {
  const usage = getUsage(params);
  usage.runUsageUsd = 0;
  setUsage(params, usage);
}

// ============================================================================
// BUDGET ENFORCEMENT
// ============================================================================

/**
 * Checks budget status before an action.
 * Returns current status and recommended tier.
 */
export function checkBudgetGuardrails(params: {
  userId?: string;
  orgId?: string;
  estimatedCostUsd?: number;
}): BudgetStatus {
  const config = getBudgetConfig(params);
  const usage = getUsage(params);
  const estimatedCost = params.estimatedCostUsd ?? 0;

  const warnings: string[] = [];
  let currentTier: BudgetStatus["currentTier"] = "smart";
  let withinBudget = true;

  // Calculate percentages
  const runPercent = (usage.runUsageUsd + estimatedCost) / config.perRunLimitUsd;
  const dailyPercent = (usage.dailyUsageUsd + estimatedCost) / config.dailyLimitUsd;
  const monthlyPercent = (usage.monthlyUsageUsd + estimatedCost) / config.monthlyLimitUsd;

  // Check run limit
  if (runPercent >= 1) {
    withinBudget = false;
    logViolation({
      userId: params.userId,
      orgId: params.orgId,
      period: "run",
      limitUsd: config.perRunLimitUsd,
      usageUsd: usage.runUsageUsd + estimatedCost,
      action: config.hardStop ? "block" : "warn",
      reason: "Per-run budget exceeded",
    });
    if (config.hardStop) currentTier = "blocked";
  } else if (runPercent >= config.warningThreshold) {
    warnings.push(`Run budget at ${Math.round(runPercent * 100)}%`);
    if (config.autoDowngrade && currentTier === "smart") currentTier = "fast";
  }

  // Check daily limit
  if (dailyPercent >= 1) {
    withinBudget = false;
    logViolation({
      userId: params.userId,
      orgId: params.orgId,
      period: "daily",
      limitUsd: config.dailyLimitUsd,
      usageUsd: usage.dailyUsageUsd + estimatedCost,
      action: config.hardStop ? "block" : "warn",
      reason: "Daily budget exceeded",
    });
    if (config.hardStop) currentTier = "blocked";
  } else if (dailyPercent >= config.warningThreshold) {
    warnings.push(`Daily budget at ${Math.round(dailyPercent * 100)}%`);
    if (config.autoDowngrade) {
      if (currentTier === "smart") currentTier = "fast";
      if (dailyPercent >= 0.9) currentTier = "cheap";
    }
  }

  // Check monthly limit
  if (monthlyPercent >= 1) {
    withinBudget = false;
    logViolation({
      userId: params.userId,
      orgId: params.orgId,
      period: "monthly",
      limitUsd: config.monthlyLimitUsd,
      usageUsd: usage.monthlyUsageUsd + estimatedCost,
      action: config.hardStop ? "block" : "warn",
      reason: "Monthly budget exceeded",
    });
    if (config.hardStop) currentTier = "blocked";
  } else if (monthlyPercent >= config.warningThreshold) {
    warnings.push(`Monthly budget at ${Math.round(monthlyPercent * 100)}%`);
    if (config.autoDowngrade && monthlyPercent >= 0.9) {
      currentTier = "cheap";
    }
  }

  return {
    withinBudget,
    warnings,
    currentTier,
    usage: {
      run: {
        used: usage.runUsageUsd,
        limit: config.perRunLimitUsd,
        percent: Math.round(runPercent * 100),
      },
      daily: {
        used: usage.dailyUsageUsd,
        limit: config.dailyLimitUsd,
        percent: Math.round(dailyPercent * 100),
      },
      monthly: {
        used: usage.monthlyUsageUsd,
        limit: config.monthlyLimitUsd,
        percent: Math.round(monthlyPercent * 100),
      },
    },
  };
}

/**
 * Logs a budget violation.
 */
function logViolation(params: Omit<BudgetViolation, "timestamp">): void {
  const violation: BudgetViolation = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  violations.unshift(violation);
  if (violations.length > MAX_VIOLATIONS) {
    violations.pop();
  }

  console.warn(`[BUDGET] Violation: ${params.reason} (${params.action})`);
}

/**
 * Gets recent violations.
 */
export function getBudgetViolations(params: {
  userId?: string;
  orgId?: string;
  limit?: number;
}): BudgetViolation[] {
  let filtered = violations;

  if (params.userId) {
    filtered = filtered.filter((v) => v.userId === params.userId);
  }
  if (params.orgId) {
    filtered = filtered.filter((v) => v.orgId === params.orgId);
  }

  return filtered.slice(0, params.limit ?? 50);
}

/**
 * Gets budget dashboard data.
 */
export function getBudgetDashboard(params: { userId?: string; orgId?: string }): {
  config: BudgetConfig;
  status: BudgetStatus;
  violations: BudgetViolation[];
} {
  return {
    config: getBudgetConfig(params),
    status: checkBudgetGuardrails(params),
    violations: getBudgetViolations({ ...params, limit: 10 }),
  };
}
