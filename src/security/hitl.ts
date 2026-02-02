/**
 * Human-in-the-Loop (HITL) - SUPER SUPREME GOD MODE
 *
 * Policy-level HITL that can be toggled on/off safely.
 */

export type HITLMode = "off" | "selective" | "full";

export type RiskLevel = "low" | "medium" | "high" | "critical";

// ============================================================================
// HITL STATE
// ============================================================================

let hitlMode: HITLMode = (process.env.HITL_MODE as HITLMode) || "selective";

/**
 * Gets current HITL mode.
 */
export function getHITLMode(): HITLMode {
  return hitlMode;
}

/**
 * Sets HITL mode. Changes apply instantly.
 */
export function setHITLMode(mode: HITLMode): void {
  if (!["off", "selective", "full"].includes(mode)) {
    throw new Error(`Invalid HITL mode: ${mode}`);
  }
  hitlMode = mode;
  console.log(`[SECURITY] HITL mode changed to: ${mode}`);
}

/**
 * Gets HITL status for dashboard.
 */
export function getHITLStatus(): {
  mode: HITLMode;
  description: string;
} {
  const descriptions: Record<HITLMode, string> = {
    off: "No confirmations required - actions execute immediately",
    selective: "Only HIGH or CRITICAL risk actions require approval",
    full: "ALL actions require human approval before execution",
  };
  return {
    mode: hitlMode,
    description: descriptions[hitlMode],
  };
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

/**
 * Assesses risk level for an action.
 */
export function assessRiskLevel(params: {
  tool: string;
  action?: string;
  isDestructive?: boolean;
  isExternal?: boolean;
  sendsData?: boolean;
  accessesSecrets?: boolean;
  modifiesConfig?: boolean;
}): RiskLevel {
  const { tool, action, isDestructive, isExternal, sendsData, accessesSecrets, modifiesConfig } =
    params;

  // Critical risk
  if (accessesSecrets && sendsData) return "critical";
  if (tool === "exec" && isDestructive) return "critical";
  if (modifiesConfig && isExternal) return "critical";

  // High risk
  if (isDestructive) return "high";
  if (accessesSecrets) return "high";
  if (tool === "exec") return "high";
  if (tool === "browser" && sendsData) return "high";

  // Medium risk
  if (isExternal) return "medium";
  if (sendsData) return "medium";
  if (modifiesConfig) return "medium";

  // Low risk
  return "low";
}

/**
 * Determines if HITL requires confirmation for a given risk level.
 */
export function hitlRequiresConfirmation(riskLevel: RiskLevel): boolean {
  switch (hitlMode) {
    case "off":
      return false;
    case "selective":
      return riskLevel === "high" || riskLevel === "critical";
    case "full":
      return true;
    default:
      return false;
  }
}

/**
 * Evaluates HITL for an action.
 * Returns whether confirmation is required.
 *
 * Note: This does NOT override DENY rules or Kill Switch.
 */
export function evaluateHITL(params: {
  tool: string;
  action?: string;
  isDestructive?: boolean;
  isExternal?: boolean;
  sendsData?: boolean;
  accessesSecrets?: boolean;
  modifiesConfig?: boolean;
}): {
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
  reason: string;
} {
  const riskLevel = assessRiskLevel(params);
  const requiresConfirmation = hitlRequiresConfirmation(riskLevel);

  let reason = "";
  if (requiresConfirmation) {
    reason = `HITL mode '${hitlMode}' requires confirmation for ${riskLevel} risk actions`;
  }

  return {
    requiresConfirmation,
    riskLevel,
    reason,
  };
}
