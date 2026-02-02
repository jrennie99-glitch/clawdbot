/**
 * Security Dashboard Gateway Methods - SUPER SUPREME GOD MODE
 *
 * RPC handlers for security dashboard functionality.
 */

import type { GatewayRequestHandlers } from "./types.js";
import {
  isKillSwitchActive,
  activateKillSwitch,
  deactivateKillSwitch,
  isLockdownModeEnabled,
  enableLockdownMode,
  disableLockdownMode,
  getSecurityStatus,
} from "../../security/kill-switch.js";
import { getQuarantinedContent, cleanupQuarantine } from "../../security/trust-zones.js";
import { getAttackLog, getAttackStats } from "../../security/integration/content-guard.js";
import { getRateLimiterStatus } from "../../security/integration/rate-limiter.js";
import {
  getPendingApprovals,
  approveToolExecution,
  denyToolExecution,
} from "../../security/integration/tool-interceptor.js";
import { getUsage, getBudget, checkBudgetStatus } from "../../security/cost-controls.js";
import { getAvailableProviders } from "../../security/llm-router.js";

// Track policy decisions in memory (recent 100)
const policyDecisions: Array<{
  timestamp: string;
  tool: string;
  action?: string;
  decision: string;
  reason: string;
  userId?: string;
}> = [];

export function recordPolicyDecision(entry: (typeof policyDecisions)[0]) {
  policyDecisions.unshift(entry);
  if (policyDecisions.length > 100) {
    policyDecisions.pop();
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
          atLimit: budgetStatus.exceeded,
          nearLimit: budgetStatus.warning,
        },
        rateLimits,
        providers: providers.map((p) => p.provider),
      });
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
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
          respond(false, undefined, { code: -32000, message: "Invalid confirmation code" });
          return;
        }
        respond(true, { enabled: false });
      }
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
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
      respond(false, undefined, { code: -32000, message: String(err) });
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
      respond(false, undefined, { code: -32000, message: String(err) });
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
      respond(false, undefined, { code: -32000, message: String(err) });
    }
  },

  /**
   * Approve pending confirmation
   */
  "security.pending.approve": async ({ params, respond }) => {
    try {
      const previewId = params.previewId as string;
      approveToolExecution(previewId, "dashboard");
      respond(true, { approved: true });
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
    }
  },

  /**
   * Deny pending confirmation
   */
  "security.pending.deny": async ({ params, respond }) => {
    try {
      const previewId = params.previewId as string;
      const reason = (params.reason as string) || "Denied via dashboard";
      denyToolExecution(previewId, reason);
      respond(true, { denied: true });
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
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
      respond(false, undefined, { code: -32000, message: String(err) });
    }
  },

  /**
   * Get quarantined memory
   */
  "security.quarantine.list": async ({ respond }) => {
    try {
      const entries = getQuarantinedContent();
      respond(true, {
        entries: (entries ?? []).map(
          (e: {
            id: string;
            source: string;
            trustLevel: string;
            timestamp: string;
            expiresAt: string;
            originalContent: string;
          }) => ({
            id: e.id,
            source: e.source,
            trustLevel: e.trustLevel,
            timestamp: e.timestamp,
            expiresAt: e.expiresAt,
            contentPreview:
              e.originalContent.slice(0, 100) + (e.originalContent.length > 100 ? "..." : ""),
          }),
        ),
        total: (entries ?? []).length,
      });
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
    }
  },

  /**
   * Delete quarantine entry
   */
  "security.quarantine.delete": async ({ respond }) => {
    try {
      cleanupQuarantine();
      respond(true, { deleted: true });
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
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
      if (status.warning) currentTier = "FAST";
      if (status.exceeded) currentTier = "CHEAP";

      respond(true, {
        tier: currentTier,
        dailyCost: usage.dailyUsageUsd.toFixed(4),
        runCost: usage.runUsageUsd.toFixed(4),
        dailyLimit: budget.dailyLimitUsd.toFixed(2),
        runLimit: budget.perRunLimitUsd.toFixed(2),
        providers: providers.map((p) => ({ id: p.provider, status: "available" })),
      });
    } catch (err) {
      respond(false, undefined, { code: -32000, message: String(err) });
    }
  },
};
