/**
 * Policy Engine - SUPER SUPREME GOD MODE
 *
 * Central deterministic policy engine for ALL tool calls and privileged actions.
 * Every action goes through this engine - no exceptions.
 */

import type { PolicyContext, PolicyEvaluationResult, PolicyRule, ActionPreview } from "./types.js";
import { isPrivateIp, isBlockedHostname, generateSecureId } from "./utils.js";
import { getKillSwitchState, getLockdownConfig } from "./kill-switch.js";

// ============================================================================
// POLICY RULES
// ============================================================================

/**
 * Built-in policy rules in priority order (higher priority = checked first).
 * SECURITY: These rules are deterministic and cannot be bypassed by LLM.
 */
const POLICY_RULES: PolicyRule[] = [
  // ========== KILL SWITCH (HIGHEST PRIORITY) ==========
  {
    id: "kill_switch",
    name: "Kill Switch Active",
    description: "Blocks all tool execution when kill switch is enabled",
    priority: 10000,
    condition: () => getKillSwitchState().enabled,
    decision: "deny",
    reason: "Kill switch is active - all tool execution disabled",
  },

  // ========== ALWAYS DENY ==========
  {
    id: "deny_secret_print",
    name: "Deny Secret Printing",
    description: "Never allow printing/logging secrets",
    priority: 9000,
    condition: (ctx) => ctx.risk.accessesSecrets === true && ctx.what.action === "print",
    decision: "deny",
    reason: "Printing secrets is never allowed",
  },
  {
    id: "deny_secret_send",
    name: "Deny Secret Exfiltration",
    description: "Never allow sending secrets externally",
    priority: 9000,
    condition: (ctx) => ctx.risk.accessesSecrets === true && ctx.risk.sendsData === true,
    decision: "deny",
    reason: "Sending secrets externally is never allowed",
  },
  {
    id: "deny_ssrf_localhost",
    name: "Deny SSRF Localhost",
    description: "Block requests to localhost/loopback",
    priority: 9000,
    condition: (ctx) => {
      const host = ctx.where.domain?.toLowerCase();
      return host ? isBlockedHostname(host) : false;
    },
    decision: "deny",
    reason: "SSRF: Requests to localhost/loopback are blocked",
  },
  {
    id: "deny_ssrf_private_ip",
    name: "Deny SSRF Private IP",
    description: "Block requests to private IP ranges",
    priority: 9000,
    condition: (ctx) => {
      const ip = ctx.where.ip;
      return ip ? isPrivateIp(ip) : false;
    },
    decision: "deny",
    reason: "SSRF: Requests to private IP ranges are blocked",
  },
  {
    id: "deny_ssrf_metadata",
    name: "Deny SSRF Cloud Metadata",
    description: "Block requests to cloud metadata endpoints",
    priority: 9000,
    condition: (ctx) => {
      const url = ctx.where.url?.toLowerCase();
      const ip = ctx.where.ip;
      return (
        url?.includes("169.254.169.254") ||
        ip === "169.254.169.254" ||
        url?.includes("metadata.google") ||
        false
      );
    },
    decision: "deny",
    reason: "SSRF: Cloud metadata access is blocked",
  },
  {
    id: "deny_infinite_loop",
    name: "Deny Tool Loop",
    description: "Block excessive tool calls in a single run",
    priority: 8500,
    condition: (ctx) => {
      const limit = ctx.budget.toolCallsLimit ?? 100;
      return (ctx.budget.toolCallsUsed ?? 0) >= limit;
    },
    decision: "deny",
    reason: "Tool call limit exceeded - potential infinite loop",
  },
  {
    id: "deny_budget_exceeded",
    name: "Deny Budget Exceeded",
    description: "Block actions when cost budget is exceeded",
    priority: 8500,
    condition: (ctx) => {
      const limit = ctx.budget.costLimitUsd ?? Infinity;
      return (ctx.budget.costUsd ?? 0) >= limit;
    },
    decision: "deny",
    reason: "Cost budget exceeded",
  },

  // ========== LOCKDOWN MODE ==========
  {
    id: "lockdown_external_comms",
    name: "Lockdown: External Communications",
    description: "Require confirmation for external sends in lockdown mode",
    priority: 8000,
    condition: (ctx) => {
      const config = getLockdownConfig();
      return config.enabled && config.externalCommsConfirm && ctx.risk.sendsData === true;
    },
    decision: "require_confirmation",
    reason: "Lockdown mode: External communication requires approval",
    requiresPreview: true,
    previewTemplate: "This action will send data externally. Approve?",
  },
  {
    id: "lockdown_writes_deletes",
    name: "Lockdown: Writes/Deletes",
    description: "Require confirmation for write/delete operations in lockdown mode",
    priority: 8000,
    condition: (ctx) => {
      const config = getLockdownConfig();
      return config.enabled && config.writesDeletesConfirm && ctx.risk.isDestructive === true;
    },
    decision: "require_confirmation",
    reason: "Lockdown mode: Destructive operation requires approval",
    requiresPreview: true,
    previewTemplate: "This action will modify or delete data. Approve?",
  },
  {
    id: "lockdown_shell_browser",
    name: "Lockdown: Shell/Browser",
    description: "Deny shell/browser operations in lockdown mode unless allowlisted",
    priority: 8000,
    condition: (ctx) => {
      const config = getLockdownConfig();
      const isShellOrBrowser = ["exec", "bash", "shell", "browser"].includes(ctx.what.tool);
      return config.enabled && config.shellBrowserDeny && isShellOrBrowser;
    },
    decision: "deny",
    reason: "Lockdown mode: Shell/browser execution is disabled",
  },
  {
    id: "lockdown_network",
    name: "Lockdown: Network Allowlist",
    description: "Only allow network to allowlisted domains in lockdown mode",
    priority: 8000,
    condition: (ctx) => {
      const config = getLockdownConfig();
      if (!config.enabled || !ctx.where.domain) return false;
      const domain = ctx.where.domain.toLowerCase();
      return !config.outboundNetworkAllowlist.some(
        (allowed) => domain === allowed || domain.endsWith("." + allowed),
      );
    },
    decision: "deny",
    reason: "Lockdown mode: Domain not in allowlist",
  },

  // ========== REQUIRE CONFIRMATION ==========
  {
    id: "confirm_external_send",
    name: "Confirm External Send",
    description: "Require confirmation for external message sending",
    priority: 5000,
    condition: (ctx) => {
      const isMessaging = ["message", "send", "email"].includes(ctx.what.tool);
      return isMessaging && ctx.risk.isExternal !== false;
    },
    decision: "require_confirmation",
    reason: "Sending external messages requires approval",
    requiresPreview: true,
    previewTemplate: "Send message to external recipient?",
  },
  {
    id: "confirm_file_write",
    name: "Confirm File Write",
    description: "Require confirmation for file writes outside workspace",
    priority: 5000,
    condition: (ctx) => {
      const isWrite = ["write", "edit", "apply_patch"].includes(ctx.what.tool);
      const path = ctx.where.filePath;
      // Check if outside standard workspace
      const isOutsideWorkspace =
        path && !path.startsWith("/workspace") && !path.startsWith("./") && !path.includes("/tmp/");
      return isWrite && isOutsideWorkspace === true;
    },
    decision: "require_confirmation",
    reason: "Writing files outside workspace requires approval",
    requiresPreview: true,
    previewTemplate: "Write to file outside workspace?",
  },
  {
    id: "confirm_delete",
    name: "Confirm Delete",
    description: "Require confirmation for delete operations",
    priority: 5000,
    condition: (ctx) => ctx.risk.isDestructive === true,
    decision: "require_confirmation",
    reason: "Destructive operations require approval",
    requiresPreview: true,
    previewTemplate: "This action will delete data. Approve?",
  },
  {
    id: "confirm_shell",
    name: "Confirm Shell Execution",
    description: "Require confirmation for shell commands",
    priority: 5000,
    condition: (ctx) => ["exec", "bash", "shell"].includes(ctx.what.tool),
    decision: "require_confirmation",
    reason: "Shell execution requires approval",
    requiresPreview: true,
    previewTemplate: "Execute shell command?",
  },
  {
    id: "confirm_browser",
    name: "Confirm Browser Actions",
    description: "Require confirmation for browser automation",
    priority: 5000,
    condition: (ctx) => ctx.what.tool === "browser",
    decision: "require_confirmation",
    reason: "Browser automation requires approval",
    requiresPreview: true,
    previewTemplate: "Perform browser action?",
  },
  {
    id: "confirm_config_change",
    name: "Confirm Config Change",
    description: "Require confirmation for configuration changes",
    priority: 5000,
    condition: (ctx) => ctx.risk.modifiesConfig === true,
    decision: "require_confirmation",
    reason: "Configuration changes require approval",
    requiresPreview: true,
    previewTemplate: "Modify system configuration?",
  },
  {
    id: "confirm_upload",
    name: "Confirm Upload",
    description: "Require confirmation for file uploads",
    priority: 5000,
    condition: (ctx) => ctx.what.action === "upload",
    decision: "require_confirmation",
    reason: "File uploads require approval",
    requiresPreview: true,
    previewTemplate: "Upload file to external service?",
  },

  // ========== ALLOW (SAFE OPERATIONS) ==========
  {
    id: "allow_read_only",
    name: "Allow Read Operations",
    description: "Allow read-only operations without confirmation",
    priority: 1000,
    condition: (ctx) => {
      const readOnlyTools = [
        "read",
        "list",
        "search",
        "memory_search",
        "memory_get",
        "session_status",
      ];
      return readOnlyTools.includes(ctx.what.tool) && !ctx.risk.isDestructive;
    },
    decision: "allow",
    reason: "Read-only operation allowed",
  },
  {
    id: "allow_local_write",
    name: "Allow Local Writes",
    description: "Allow writes within workspace",
    priority: 1000,
    condition: (ctx) => {
      const isWrite = ["write", "edit", "apply_patch"].includes(ctx.what.tool);
      const path = ctx.where.filePath;
      const isInWorkspace = path && (path.startsWith("/workspace") || path.startsWith("./"));
      return isWrite && isInWorkspace === true;
    },
    decision: "allow",
    reason: "Workspace write allowed",
  },
  {
    id: "allow_safe_web",
    name: "Allow Safe Web Fetch",
    description: "Allow web fetches to public domains",
    priority: 1000,
    condition: (ctx) => {
      if (ctx.what.tool !== "web_fetch" && ctx.what.tool !== "web_search") return false;
      const domain = ctx.where.domain;
      const ip = ctx.where.ip;
      if (!domain) return false;
      if (isBlockedHostname(domain)) return false;
      if (ip && isPrivateIp(ip)) return false;
      return true;
    },
    decision: "allow",
    reason: "Web fetch to public domain allowed",
  },
  {
    id: "allow_canvas",
    name: "Allow Canvas Operations",
    description: "Allow canvas/UI operations",
    priority: 1000,
    condition: (ctx) => ctx.what.tool === "canvas",
    decision: "allow",
    reason: "Canvas operation allowed",
  },
  {
    id: "allow_image",
    name: "Allow Image Operations",
    description: "Allow image generation/processing",
    priority: 1000,
    condition: (ctx) => ctx.what.tool === "image",
    decision: "allow",
    reason: "Image operation allowed",
  },
];

// ============================================================================
// POLICY ENGINE
// ============================================================================

/**
 * Evaluates a policy context against all rules.
 * Returns the first matching rule's decision.
 */
export function evaluatePolicy(context: PolicyContext): PolicyEvaluationResult {
  // Sort rules by priority (highest first)
  const sortedRules = [...POLICY_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    try {
      if (rule.condition(context)) {
        return {
          decision: rule.decision,
          reason: rule.reason,
          ruleId: rule.id,
          requiresPreview: rule.requiresPreview,
          previewMessage: rule.previewTemplate,
        };
      }
    } catch (error) {
      // Rule evaluation error - fail safe (deny)
      return {
        decision: "deny",
        reason: `Rule evaluation error (${rule.id}): ${String(error)}`,
        ruleId: rule.id,
      };
    }
  }

  // Default: require confirmation for unknown actions
  return {
    decision: "require_confirmation",
    reason: "Unknown action - defaulting to confirmation requirement",
  };
}

/**
 * Quick check if an action would be denied.
 */
export function wouldDeny(context: PolicyContext): boolean {
  return evaluatePolicy(context).decision === "deny";
}

/**
 * Quick check if an action would require confirmation.
 */
export function wouldRequireConfirmation(context: PolicyContext): boolean {
  return evaluatePolicy(context).decision === "require_confirmation";
}

// ============================================================================
// ACTION PREVIEW MANAGEMENT
// ============================================================================

const pendingPreviews = new Map<string, ActionPreview>();

/**
 * Creates an action preview for confirmation.
 */
export function createActionPreview(params: {
  tool: string;
  action: string;
  description: string;
  context: PolicyContext;
  timeoutMs?: number;
}): ActionPreview {
  const { tool, action, description, context, timeoutMs = 300000 } = params; // 5 min default

  const evaluation = evaluatePolicy(context);
  const now = new Date();

  const preview: ActionPreview = {
    id: generateSecureId("preview"),
    tool,
    action,
    description,
    riskLevel: determineRiskLevel(context),
    impacts: determineImpacts(context),
    reversible: isReversible(tool, action),
    requiresConfirmation: evaluation.decision === "require_confirmation",
    timeout: timeoutMs,
    createdAt: now,
    expiresAt: new Date(now.getTime() + timeoutMs),
    status: "pending",
  };

  pendingPreviews.set(preview.id, preview);

  return preview;
}

/**
 * Approves an action preview.
 */
export function approveActionPreview(previewId: string, approvedBy?: string): boolean {
  const preview = pendingPreviews.get(previewId);

  if (!preview) return false;
  if (preview.status !== "pending") return false;
  if (new Date() > preview.expiresAt) {
    preview.status = "expired";
    return false;
  }

  preview.status = "approved";
  preview.approvedBy = approvedBy;
  preview.approvedAt = new Date();

  return true;
}

/**
 * Denies an action preview.
 */
export function denyActionPreview(previewId: string): boolean {
  const preview = pendingPreviews.get(previewId);

  if (!preview) return false;
  if (preview.status !== "pending") return false;

  preview.status = "denied";

  return true;
}

/**
 * Checks if a preview is approved.
 */
export function isPreviewApproved(previewId: string): boolean {
  const preview = pendingPreviews.get(previewId);
  return preview?.status === "approved";
}

/**
 * Gets a pending preview.
 */
export function getActionPreview(previewId: string): ActionPreview | undefined {
  return pendingPreviews.get(previewId);
}

/**
 * Cleans up expired previews.
 */
export function cleanupExpiredPreviews(): number {
  const now = new Date();
  let removed = 0;

  for (const [id, preview] of pendingPreviews) {
    if (now > preview.expiresAt || preview.status !== "pending") {
      if (preview.status === "pending") {
        preview.status = "expired";
      }
      // Keep for audit for a while, then remove
      const age = now.getTime() - preview.expiresAt.getTime();
      if (age > 3600000) {
        // 1 hour after expiry
        pendingPreviews.delete(id);
        removed++;
      }
    }
  }

  return removed;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function determineRiskLevel(context: PolicyContext): ActionPreview["riskLevel"] {
  if (context.risk.accessesSecrets) return "critical";
  if (context.risk.isDestructive) return "high";
  if (context.risk.isExternal || context.risk.sendsData) return "medium";
  return "low";
}

function determineImpacts(context: PolicyContext): string[] {
  const impacts: string[] = [];

  if (context.risk.isDestructive) impacts.push("May delete or modify data");
  if (context.risk.isExternal) impacts.push("Communicates with external systems");
  if (context.risk.sendsData) impacts.push("Sends data externally");
  if (context.risk.accessesSecrets) impacts.push("Accesses sensitive credentials");
  if (context.risk.modifiesConfig) impacts.push("Modifies system configuration");

  return impacts;
}

function isReversible(tool: string, action?: string): boolean {
  const irreversibleTools = ["message", "send", "email", "exec", "shell"];
  const irreversibleActions = ["delete", "remove", "drop", "send"];

  if (irreversibleTools.includes(tool)) return false;
  if (action && irreversibleActions.includes(action)) return false;

  return true;
}

/**
 * Adds a custom policy rule.
 * SECURITY: Only use for extending default rules, never for bypassing.
 */
export function addPolicyRule(rule: PolicyRule): void {
  POLICY_RULES.push(rule);
}

/**
 * Gets all policy rules (for auditing).
 */
export function getPolicyRules(): PolicyRule[] {
  return [...POLICY_RULES];
}
