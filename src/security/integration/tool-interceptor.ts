/**
 * Tool Interceptor - SUPER SUPREME GOD MODE
 *
 * Central interception point for ALL tool executions.
 * Wires security modules into existing tool execution paths.
 */

import type { PolicyContext, PolicyEvaluationResult } from "../types.js";
import { evaluatePolicy, createActionPreview } from "../policy-engine.js";
import { getKillSwitchState, getLockdownConfig } from "../kill-switch.js";
import { recordToolCall, checkBudgetStatus } from "../cost-controls.js";
import { redactSecrets } from "../secret-redaction.js";
import { isPrivateIp, isBlockedHostname } from "../utils.js";

// ============================================================================
// TOOL CALL INTERCEPTION
// ============================================================================

export type ToolCallRequest = {
  toolName: string;
  action?: string;
  parameters?: Record<string, unknown>;
  userId?: string;
  sessionKey?: string;
  agentId?: string;
};

export type ToolCallDecision = {
  allowed: boolean;
  decision: "allow" | "require_confirmation" | "deny";
  reason: string;
  ruleId?: string;
  previewId?: string;
};

/**
 * Pending approvals for tools requiring confirmation
 */
const pendingApprovals = new Map<
  string,
  {
    request: ToolCallRequest;
    context: PolicyContext;
    createdAt: Date;
    expiresAt: Date;
  }
>();

/**
 * Intercepts a tool call and evaluates it against the policy engine.
 * This is the main entry point for security enforcement.
 *
 * @returns Decision whether to allow, deny, or require confirmation
 */
export function interceptToolCall(request: ToolCallRequest): ToolCallDecision {
  // Track tool call for budget enforcement
  recordToolCall();

  // Build policy context from request
  const context = buildPolicyContext(request);

  // Evaluate against policy engine
  const result = evaluatePolicy(context);

  // Handle confirmation requirement
  if (result.decision === "require_confirmation") {
    const preview = createActionPreview({
      tool: request.toolName,
      action: request.action ?? "execute",
      description: `Execute ${request.toolName}${request.action ? `:${request.action}` : ""}`,
      context,
    });

    pendingApprovals.set(preview.id, {
      request,
      context,
      createdAt: new Date(),
      expiresAt: preview.expiresAt,
    });

    return {
      allowed: false,
      decision: "require_confirmation",
      reason: result.reason,
      ruleId: result.ruleId,
      previewId: preview.id,
    };
  }

  return {
    allowed: result.decision === "allow",
    decision: result.decision,
    reason: result.reason,
    ruleId: result.ruleId,
  };
}

/**
 * Builds a PolicyContext from a tool call request.
 */
function buildPolicyContext(request: ToolCallRequest): PolicyContext {
  const params = request.parameters ?? {};

  // Extract URL/domain info for SSRF checks
  const urlParam = (params.url ?? params.targetUrl ?? params.endpoint) as string | undefined;
  let domain: string | undefined;
  let ip: string | undefined;

  if (urlParam) {
    try {
      const parsed = new URL(urlParam);
      domain = parsed.hostname;
    } catch {
      // Invalid URL, will be caught elsewhere
    }
  }

  // Check if IP is private
  if (domain && /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    ip = domain;
  }

  // Determine risk factors
  const isDestructive = isDestructiveAction(request.toolName, request.action, params);
  const isExternal = isExternalAction(request.toolName, request.action);
  const sendsData = sendsExternalData(request.toolName, request.action);
  const accessesSecrets = accessesSecretData(request.toolName, request.action, params);
  const modifiesConfig = modifiesConfiguration(request.toolName, request.action);

  // Get budget status
  const budgetStatus = checkBudgetStatus();

  return {
    who: {
      userId: request.userId,
      sessionKey: request.sessionKey,
      agentId: request.agentId,
    },
    what: {
      tool: request.toolName,
      action: request.action,
      parameters: params,
    },
    where: {
      domain,
      ip,
      url: urlParam,
      filePath: (params.path ?? params.filePath ?? params.workdir) as string | undefined,
    },
    risk: {
      isDestructive,
      isExternal,
      sendsData,
      accessesSecrets,
      modifiesConfig,
    },
    budget: {
      tokensUsed: budgetStatus.tokensRemaining < 100000 ? 100000 - budgetStatus.tokensRemaining : 0,
      toolCallsUsed:
        budgetStatus.toolCallsRemaining < 100 ? 100 - budgetStatus.toolCallsRemaining : 0,
      toolCallsLimit: 100,
      costUsd: budgetStatus.dailyRemaining < 10 ? 10 - budgetStatus.dailyRemaining : 0,
      costLimitUsd: 10,
    },
  };
}

// ============================================================================
// RISK ASSESSMENT HELPERS
// ============================================================================

const DESTRUCTIVE_TOOLS = ["exec", "bash", "shell", "delete", "remove", "drop"];
const DESTRUCTIVE_ACTIONS = ["delete", "remove", "drop", "clear", "truncate", "kill"];

function isDestructiveAction(
  tool: string,
  action?: string,
  params?: Record<string, unknown>,
): boolean {
  if (DESTRUCTIVE_TOOLS.includes(tool)) return true;
  if (action && DESTRUCTIVE_ACTIONS.includes(action)) return true;

  // Check command content for destructive patterns
  const command = (params?.command ?? "") as string;
  if (/rm\s+(-[a-z]*)?\s*-?rf?/i.test(command)) return true;
  if (/drop\s+(table|database)/i.test(command)) return true;
  if (/delete\s+from/i.test(command)) return true;

  return false;
}

const EXTERNAL_TOOLS = ["message", "send", "email", "web_fetch", "browser", "http"];
const EXTERNAL_ACTIONS = ["send", "post", "upload", "fetch"];

function isExternalAction(tool: string, action?: string): boolean {
  if (EXTERNAL_TOOLS.includes(tool)) return true;
  if (action && EXTERNAL_ACTIONS.includes(action)) return true;
  return false;
}

const DATA_SENDING_TOOLS = ["message", "send", "email", "upload", "post"];

function sendsExternalData(tool: string, action?: string): boolean {
  if (DATA_SENDING_TOOLS.includes(tool)) return true;
  if (action === "send" || action === "post" || action === "upload") return true;
  return false;
}

function accessesSecretData(
  tool: string,
  action?: string,
  params?: Record<string, unknown>,
): boolean {
  // Check if parameters might contain secrets
  if (params) {
    const paramsStr = JSON.stringify(params);
    const redacted = redactSecrets(paramsStr);
    if (redacted.wasRedacted) return true;
  }
  return false;
}

const CONFIG_TOOLS = ["config", "settings", "preferences"];
const CONFIG_ACTIONS = ["set", "update", "modify", "change"];

function modifiesConfiguration(tool: string, action?: string): boolean {
  if (CONFIG_TOOLS.includes(tool)) return true;
  if (action && CONFIG_ACTIONS.includes(action)) return true;
  return false;
}

// ============================================================================
// APPROVAL MANAGEMENT
// ============================================================================

/**
 * Approves a pending tool execution.
 */
export function approveToolExecution(previewId: string): boolean {
  const pending = pendingApprovals.get(previewId);
  if (!pending) return false;

  if (new Date() > pending.expiresAt) {
    pendingApprovals.delete(previewId);
    return false;
  }

  pendingApprovals.delete(previewId);
  return true;
}

/**
 * Denies a pending tool execution.
 */
export function denyToolExecution(previewId: string): boolean {
  return pendingApprovals.delete(previewId);
}

/**
 * Gets all pending approvals.
 */
export function getPendingApprovals(): Array<{
  id: string;
  toolName: string;
  action?: string;
  createdAt: Date;
  expiresAt: Date;
}> {
  const now = new Date();
  const result: Array<{
    id: string;
    toolName: string;
    action?: string;
    createdAt: Date;
    expiresAt: Date;
  }> = [];

  for (const [id, pending] of pendingApprovals) {
    if (now > pending.expiresAt) {
      pendingApprovals.delete(id);
      continue;
    }
    result.push({
      id,
      toolName: pending.request.toolName,
      action: pending.request.action,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
    });
  }

  return result;
}

// ============================================================================
// SECURITY STATUS
// ============================================================================

/**
 * Quick check if tool execution is globally enabled.
 */
export function isToolExecutionEnabled(): boolean {
  return !getKillSwitchState().enabled;
}

/**
 * Gets current security mode status.
 */
export function getSecurityModeStatus(): {
  killSwitchActive: boolean;
  lockdownEnabled: boolean;
  toolExecutionAllowed: boolean;
} {
  const killSwitch = getKillSwitchState();
  const lockdown = getLockdownConfig();

  return {
    killSwitchActive: killSwitch.enabled,
    lockdownEnabled: lockdown.enabled,
    toolExecutionAllowed: !killSwitch.enabled,
  };
}
