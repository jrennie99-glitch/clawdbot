/**
 * Exec Wrapper - SUPER SUPREME GOD MODE
 *
 * Wraps tool execution to enforce the Policy Engine.
 * This is the critical integration point for tool security.
 */

import {
  interceptToolCall,
  isToolExecutionEnabled,
  type ToolCallRequest,
  type ToolCallDecision,
} from "./tool-interceptor.js";
import { isKillSwitchActive, getLockdownConfig } from "../kill-switch.js";
import { redactSecrets } from "../secret-redaction.js";
import { isPrivateIp, isBlockedHostname } from "../utils.js";
import { recordToolCall } from "../cost-controls.js";

export type ExecSecurityResult = {
  allowed: boolean;
  decision: "allow" | "require_confirmation" | "deny";
  reason: string;
  previewId?: string;
};

/**
 * Pre-execution security check for ANY tool call.
 * MUST be called before executing any tool.
 *
 * @returns Security decision - caller must respect this
 */
export function checkToolExecution(params: {
  toolName: string;
  action?: string;
  parameters?: Record<string, unknown>;
  userId?: string;
  sessionKey?: string;
  agentId?: string;
}): ExecSecurityResult {
  // KILL SWITCH - Immediate deny
  if (isKillSwitchActive()) {
    return {
      allowed: false,
      decision: "deny",
      reason: "KILL SWITCH ACTIVE - All tool execution disabled",
    };
  }

  // Build request for interceptor
  const request: ToolCallRequest = {
    toolName: params.toolName,
    action: params.action,
    parameters: params.parameters,
    userId: params.userId,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
  };

  // Run through policy engine
  const decision = interceptToolCall(request);

  return {
    allowed: decision.allowed,
    decision: decision.decision,
    reason: decision.reason,
    previewId: decision.previewId,
  };
}

/**
 * Validates a command for SSRF before execution.
 */
export function validateCommandForSSRF(command: string): {
  safe: boolean;
  reason?: string;
} {
  const lowered = command.toLowerCase();

  // Check for curl/wget to internal IPs
  if (lowered.includes("curl") || lowered.includes("wget") || lowered.includes("fetch")) {
    // Extract URLs from command
    const urlMatches = command.match(/https?:\/\/[^\s]+/gi) || [];

    for (const url of urlMatches) {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;

        // Block localhost
        if (isBlockedHostname(hostname)) {
          return {
            safe: false,
            reason: `SSRF blocked: ${hostname} is not allowed`,
          };
        }

        // Block private IPs
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isPrivateIp(hostname)) {
          return {
            safe: false,
            reason: `SSRF blocked: Private IP ${hostname} is not allowed`,
          };
        }

        // Block cloud metadata endpoints
        if (
          hostname === "169.254.169.254" ||
          hostname.includes("metadata.google") ||
          hostname.includes("metadata.aws")
        ) {
          return {
            safe: false,
            reason: `SSRF blocked: Cloud metadata endpoint ${hostname} is not allowed`,
          };
        }
      } catch {
        // Invalid URL, continue
      }
    }
  }

  return { safe: true };
}

/**
 * Validates command for secret exfiltration attempts.
 */
export function validateCommandForExfiltration(command: string): {
  safe: boolean;
  reason?: string;
} {
  const lowered = command.toLowerCase();

  // Check for piping env vars or credentials to external commands
  const dangerousPatterns = [
    /\$\{?[A-Z_]*KEY[A-Z_]*\}?\s*\|/i,
    /\$\{?[A-Z_]*SECRET[A-Z_]*\}?\s*\|/i,
    /\$\{?[A-Z_]*TOKEN[A-Z_]*\}?\s*\|/i,
    /\$\{?[A-Z_]*PASSWORD[A-Z_]*\}?\s*\|/i,
    /cat\s+[^\s]*\.env\s*\|/i,
    /echo\s+\$\{?[A-Z_]*\}?\s*\|\s*(curl|wget|nc|netcat)/i,
    /printenv\s*\|\s*(curl|wget|nc|netcat)/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return {
        safe: false,
        reason: "Potential secret exfiltration detected",
      };
    }
  }

  // Check if command contains actual secrets
  const redacted = redactSecrets(command);
  if (redacted.wasRedacted && redacted.secretsFound.some((s) => s.severity === "critical")) {
    // Only block if sending externally
    if (/(curl|wget|nc|netcat|ssh|scp)\s/i.test(lowered)) {
      return {
        safe: false,
        reason: "Command contains secrets and attempts external communication",
      };
    }
  }

  return { safe: true };
}

/**
 * Full security validation for exec commands.
 */
export function validateExecCommand(params: {
  command: string;
  toolName?: string;
  userId?: string;
  sessionKey?: string;
  agentId?: string;
}): ExecSecurityResult {
  // Kill switch check
  if (isKillSwitchActive()) {
    return {
      allowed: false,
      decision: "deny",
      reason: "KILL SWITCH ACTIVE",
    };
  }

  // SSRF check
  const ssrfResult = validateCommandForSSRF(params.command);
  if (!ssrfResult.safe) {
    return {
      allowed: false,
      decision: "deny",
      reason: ssrfResult.reason ?? "SSRF blocked",
    };
  }

  // Exfiltration check
  const exfilResult = validateCommandForExfiltration(params.command);
  if (!exfilResult.safe) {
    return {
      allowed: false,
      decision: "deny",
      reason: exfilResult.reason ?? "Exfiltration blocked",
    };
  }

  // Full policy check
  return checkToolExecution({
    toolName: params.toolName ?? "exec",
    action: "execute",
    parameters: { command: params.command },
    userId: params.userId,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
  });
}
