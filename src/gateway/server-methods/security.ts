/**
 * Security Dashboard Gateway Methods - SUPER SUPREME GOD MODE
 *
 * RPC handlers for security dashboard functionality.
 */

import type { GatewayRequestHandlers } from "./types.js";
import {
  activateKillSwitch,
  deactivateKillSwitch,
  isLockdownModeEnabled,
  enableLockdownMode,
  disableLockdownMode,
  getSecurityStatus,
} from "../../security/kill-switch.js";
import { cleanupQuarantine } from "../../security/trust-zones.js";
import { getAttackLog, getAttackStats } from "../../security/integration/content-guard.js";
import { getRateLimiterStatus } from "../../security/integration/rate-limiter.js";
import {
  getPendingApprovals,
  approveToolExecution,
  denyToolExecution,
} from "../../security/integration/tool-interceptor.js";
import { getUsage, getBudget, checkBudgetStatus } from "../../security/cost-controls.js";
import { getAvailableProviders } from "../../security/llm-router.js";
import { getHITLMode, setHITLMode, getHITLStatus, type HITLMode } from "../../security/hitl.js";
import {
  logAuditEntry,
  getRunAuditTrail,
  getRunSummary,
  listRuns,
  getAuditLog,
  exportAuditTrail,
  getAuditStats,
} from "../../security/audit-trail.js";
import {
  checkBudgetGuardrails,
  getBudgetDashboard,
  getBudgetViolations,
  setUserBudgetConfig,
  setOrgBudgetConfig,
} from "../../security/budget-guardrails.js";

// Track policy decisions in memory (recent 100)
const policyDecisions: Array<{
  timestamp: string;
  tool: string;
  action?: string;
  decision: string;
  reason: string;
  userId?: string;
}> = [];

// Track quarantine entries
const quarantineEntries: Array<{
  id: string;
  source: string;
  trustLevel: string;
  timestamp: string;
  expiresAt: string;
  originalContent: string;
}> = [];

export function recordPolicyDecision(entry: (typeof policyDecisions)[0]) {
  policyDecisions.unshift(entry);
  if (policyDecisions.length > 100) {
    policyDecisions.pop();
  }
}

export function addQuarantineEntry(entry: (typeof quarantineEntries)[0]) {
  quarantineEntries.unshift(entry);
  if (quarantineEntries.length > 100) {
    quarantineEntries.pop();
  }
}

export const securityHandlers: GatewayRequestHandlers = {
  /**
   * Get complete security status
   */
  "security.status": async ({ respond }) => {
    try {
      const status = getSecurityStatus();
      const budget = getBudget();
      const usage = getUsage();
      const budgetStatus = checkBudgetStatus();
      const rateLimits = getRateLimiterStatus();
      const providers = getAvailableProviders();

      respond(true, {
        killSwitch: status.killSwitch,
        lockdown: status.lockdown,
        budget: {
          daily: budget.dailyLimitUsd,
          perRun: budget.perRunLimitUsd,
          tokensPerRun: budget.tokensPerRunLimit,
          toolCallsPerRun: budget.toolCallsPerRunLimit,
        },
        usage: {
          dailyCost: usage.dailyUsageUsd,
          runCost: usage.runUsageUsd,
          runTokens: usage.tokensUsed,
          runToolCalls: usage.toolCallsUsed,
        },
        budgetStatus: {
          dailyRemaining: budgetStatus.dailyRemaining,
          runRemaining: budgetStatus.runRemaining,
          atLimit: !budgetStatus.withinBudget,
          nearLimit: budgetStatus.warnings.length > 0,
        },
        rateLimits,
        providers,
      });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Toggle kill switch
   */
  "security.killswitch.set": async ({ params, respond }) => {
    try {
      const enabled = params.enabled as boolean;
      const reason = (params.reason as string) || "Manual toggle via dashboard";
      const confirmCode = params.confirmCode as string | undefined;

      if (enabled) {
        activateKillSwitch({ reason, activatedBy: "dashboard" });
        respond(true, { enabled: true });
      } else {
        const success = deactivateKillSwitch({
          deactivatedBy: "dashboard",
          confirmCode: confirmCode || "CONFIRM_DEACTIVATE",
        });
        if (!success) {
          respond(false, undefined, { code: "INVALID_CODE", message: "Invalid confirmation code" });
          return;
        }
        respond(true, { enabled: false });
      }
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Toggle lockdown mode
   */
  "security.lockdown.set": async ({ params, respond }) => {
    try {
      const enabled = params.enabled as boolean;

      if (enabled) {
        enableLockdownMode();
      } else {
        disableLockdownMode();
      }
      respond(true, { enabled: isLockdownModeEnabled() });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get recent policy decisions
   */
  "security.decisions.list": async ({ params, respond }) => {
    try {
      const limit = Math.min((params.limit as number) || 50, 100);
      respond(true, {
        decisions: policyDecisions.slice(0, limit),
        total: policyDecisions.length,
      });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get pending confirmations
   */
  "security.pending.list": async ({ respond }) => {
    try {
      const pending = getPendingApprovals();
      respond(true, { pending });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Approve pending confirmation
   */
  "security.pending.approve": async ({ params, respond }) => {
    try {
      const previewId = params.previewId as string;
      approveToolExecution(previewId);
      respond(true, { approved: true });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Deny pending confirmation
   */
  "security.pending.deny": async ({ params, respond }) => {
    try {
      const previewId = params.previewId as string;
      denyToolExecution(previewId);
      respond(true, { denied: true });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get attack log
   */
  "security.attacks.list": async ({ params, respond }) => {
    try {
      const limit = Math.min((params.limit as number) || 50, 100);
      const log = getAttackLog();
      const stats = getAttackStats();
      respond(true, {
        attacks: log.slice(0, limit),
        stats,
        total: log.length,
      });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get quarantined memory
   */
  "security.quarantine.list": async ({ respond }) => {
    try {
      respond(true, {
        entries: quarantineEntries.map((e) => ({
          id: e.id,
          source: e.source,
          trustLevel: e.trustLevel,
          timestamp: e.timestamp,
          expiresAt: e.expiresAt,
          contentPreview:
            e.originalContent.slice(0, 100) + (e.originalContent.length > 100 ? "..." : ""),
        })),
        total: quarantineEntries.length,
      });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Delete quarantine entry
   */
  "security.quarantine.delete": async ({ respond }) => {
    try {
      cleanupQuarantine(0); // Remove all with maxAge=0
      quarantineEntries.length = 0;
      respond(true, { deleted: true });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get cost/usage summary
   */
  "security.cost.status": async ({ respond }) => {
    try {
      const budget = getBudget();
      const usage = getUsage();
      const status = checkBudgetStatus();
      const providers = getAvailableProviders();

      // Determine current tier based on budget
      let currentTier = "SMART";
      if (status.warnings.length > 0) currentTier = "FAST";
      if (!status.withinBudget) currentTier = "CHEAP";

      respond(true, {
        tier: currentTier,
        dailyCost: usage.dailyUsageUsd.toFixed(4),
        runCost: usage.runUsageUsd.toFixed(4),
        dailyLimit: budget.dailyLimitUsd.toFixed(2),
        runLimit: budget.perRunLimitUsd.toFixed(2),
        providers: providers.map((p) => ({ id: p, status: "available" })),
      });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  // ============================================================================
  // HITL (Human-in-the-Loop)
  // ============================================================================

  /**
   * Get HITL status
   */
  "security.hitl.status": async ({ respond }) => {
    try {
      const status = getHITLStatus();
      respond(true, status);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Set HITL mode
   */
  "security.hitl.set": async ({ params, respond }) => {
    try {
      const mode = params.mode as HITLMode;
      setHITLMode(mode);
      respond(true, { mode: getHITLMode() });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  // ============================================================================
  // AUDIT TRAIL
  // ============================================================================

  /**
   * List runs
   */
  "security.audit.runs": async ({ params, respond }) => {
    try {
      const result = listRuns({
        userId: params.userId as string | undefined,
        orgId: params.orgId as string | undefined,
        status: params.status as "running" | "completed" | "failed" | "denied" | undefined,
        riskLevel: params.riskLevel as string | undefined,
        limit: params.limit as number | undefined,
        offset: params.offset as number | undefined,
      });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get run audit trail (replay)
   */
  "security.audit.trail": async ({ params, respond }) => {
    try {
      const runId = params.runId as string;
      const entries = getRunAuditTrail(runId);
      const summary = getRunSummary(runId);
      respond(true, { runId, summary, entries });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get audit log
   */
  "security.audit.log": async ({ params, respond }) => {
    try {
      const entries = getAuditLog({
        runId: params.runId as string | undefined,
        userId: params.userId as string | undefined,
        orgId: params.orgId as string | undefined,
        eventType: params.eventType as
          | "run_start"
          | "input_received"
          | "policy_decision"
          | "tool_call"
          | "llm_call"
          | "output_generated"
          | "run_complete"
          | "error"
          | undefined,
        limit: params.limit as number | undefined,
      });
      respond(true, { entries });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Export audit trail as JSON
   */
  "security.audit.export": async ({ params, respond }) => {
    try {
      const runId = params.runId as string;
      const json = exportAuditTrail(runId);
      respond(true, { json });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get audit statistics
   */
  "security.audit.stats": async ({ respond }) => {
    try {
      const stats = getAuditStats();
      respond(true, stats);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  // ============================================================================
  // BUDGET GUARDRAILS
  // ============================================================================

  /**
   * Get budget dashboard
   */
  "security.budget.dashboard": async ({ params, respond }) => {
    try {
      const dashboard = getBudgetDashboard({
        userId: params.userId as string | undefined,
        orgId: params.orgId as string | undefined,
      });
      respond(true, dashboard);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Check budget guardrails
   */
  "security.budget.check": async ({ params, respond }) => {
    try {
      const status = checkBudgetGuardrails({
        userId: params.userId as string | undefined,
        orgId: params.orgId as string | undefined,
        estimatedCostUsd: params.estimatedCostUsd as number | undefined,
      });
      respond(true, status);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get budget violations
   */
  "security.budget.violations": async ({ params, respond }) => {
    try {
      const violations = getBudgetViolations({
        userId: params.userId as string | undefined,
        orgId: params.orgId as string | undefined,
        limit: params.limit as number | undefined,
      });
      respond(true, { violations });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Set user budget config
   */
  "security.budget.setUser": async ({ params, respond }) => {
    try {
      const userId = params.userId as string;
      setUserBudgetConfig(userId, {
        perRunLimitUsd: params.perRunLimitUsd as number | undefined,
        dailyLimitUsd: params.dailyLimitUsd as number | undefined,
        monthlyLimitUsd: params.monthlyLimitUsd as number | undefined,
        warningThreshold: params.warningThreshold as number | undefined,
        autoDowngrade: params.autoDowngrade as boolean | undefined,
        hardStop: params.hardStop as boolean | undefined,
      });
      respond(true, { success: true });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Set org budget config
   */
  "security.budget.setOrg": async ({ params, respond }) => {
    try {
      const orgId = params.orgId as string;
      setOrgBudgetConfig(orgId, {
        perRunLimitUsd: params.perRunLimitUsd as number | undefined,
        dailyLimitUsd: params.dailyLimitUsd as number | undefined,
        monthlyLimitUsd: params.monthlyLimitUsd as number | undefined,
        warningThreshold: params.warningThreshold as number | undefined,
        autoDowngrade: params.autoDowngrade as boolean | undefined,
        hardStop: params.hardStop as boolean | undefined,
      });
      respond(true, { success: true });
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },
};
