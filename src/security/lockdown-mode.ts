/**
 * Security Lockdown Mode
 *
 * Emergency lockdown with configurable restrictions:
 * - Admin-only access
 * - Chat disabled
 * - Gateway restricted
 * - All controlled via env vars
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security").child("lockdown");

// ============================================================================
// CONFIGURATION
// ============================================================================

export const LOCKDOWN_CONFIG = {
  // Master lockdown switch
  enabled: process.env.SECURITY_LOCKDOWN === "true",

  // Admin access
  adminEmail: process.env.SECURITY_ADMIN_EMAIL?.trim() || undefined,
  adminOnlyMode: process.env.SECURITY_ADMIN_ONLY === "true",

  // Feature restrictions
  chatDisabled: process.env.SECURITY_CHAT_DISABLED === "true",
  gatewayRestricted: process.env.SECURITY_GATEWAY_RESTRICTED === "true",
  toolsDisabled: process.env.SECURITY_TOOLS_DISABLED === "true",

  // Emergency mode
  emergencyMode: process.env.SECURITY_EMERGENCY === "true",
};

// ============================================================================
// LOCKDOWN STATE
// ============================================================================

interface LockdownState {
  enabled: boolean;
  activatedAt?: Date;
  activatedBy?: string;
  reason?: string;
  restrictions: {
    adminOnly: boolean;
    chatDisabled: boolean;
    gatewayRestricted: boolean;
    toolsDisabled: boolean;
  };
}

let lockdownState: LockdownState = {
  enabled: LOCKDOWN_CONFIG.enabled,
  activatedAt: LOCKDOWN_CONFIG.enabled ? new Date() : undefined,
  reason: LOCKDOWN_CONFIG.enabled ? "Environment configuration" : undefined,
  restrictions: {
    adminOnly: LOCKDOWN_CONFIG.adminOnlyMode,
    chatDisabled: LOCKDOWN_CONFIG.chatDisabled,
    gatewayRestricted: LOCKDOWN_CONFIG.gatewayRestricted,
    toolsDisabled: LOCKDOWN_CONFIG.toolsDisabled,
  },
};

/**
 * Get current lockdown state
 */
export function getLockdownState(): LockdownState {
  return { ...lockdownState };
}

/**
 * Check if lockdown is active
 */
export function isLockdownActive(): boolean {
  return lockdownState.enabled;
}

/**
 * Activate lockdown mode
 */
export function activateLockdown(params?: {
  reason?: string;
  activatedBy?: string;
  restrictions?: Partial<LockdownState["restrictions"]>;
}): void {
  lockdownState = {
    enabled: true,
    activatedAt: new Date(),
    activatedBy: params?.activatedBy,
    reason: params?.reason ?? "Manual activation",
    restrictions: {
      adminOnly: params?.restrictions?.adminOnly ?? true,
      chatDisabled: params?.restrictions?.chatDisabled ?? true,
      gatewayRestricted: params?.restrictions?.gatewayRestricted ?? true,
      toolsDisabled: params?.restrictions?.toolsDisabled ?? true,
    },
  };

  log.warn(`LOCKDOWN ACTIVATED: ${lockdownState.reason}`, {
    activatedBy: params?.activatedBy,
    restrictions: lockdownState.restrictions,
  });
}

/**
 * Deactivate lockdown mode
 */
export function deactivateLockdown(params?: { deactivatedBy?: string }): void {
  log.warn(`Lockdown deactivated by: ${params?.deactivatedBy ?? "unknown"}`);

  lockdownState = {
    enabled: false,
    restrictions: {
      adminOnly: false,
      chatDisabled: false,
      gatewayRestricted: false,
      toolsDisabled: false,
    },
  };
}

/**
 * Check if a user has admin access
 */
export function isAdminUser(email?: string): boolean {
  if (!LOCKDOWN_CONFIG.adminEmail) return true; // No admin configured = all users allowed
  if (!email) return false;
  return email.toLowerCase().trim() === LOCKDOWN_CONFIG.adminEmail.toLowerCase();
}

/**
 * Check if access is allowed during lockdown
 */
export function checkLockdownAccess(params: {
  email?: string;
  action: "chat" | "gateway" | "tools" | "api";
}): { allowed: boolean; reason?: string } {
  if (!lockdownState.enabled) {
    return { allowed: true };
  }

  // Admin override
  if (params.email && isAdminUser(params.email)) {
    return { allowed: true };
  }

  // Check admin-only mode
  if (lockdownState.restrictions.adminOnly) {
    return { allowed: false, reason: "Admin access only during lockdown" };
  }

  // Check specific restrictions
  switch (params.action) {
    case "chat":
      if (lockdownState.restrictions.chatDisabled) {
        return { allowed: false, reason: "Chat disabled during lockdown" };
      }
      break;
    case "gateway":
      if (lockdownState.restrictions.gatewayRestricted) {
        return { allowed: false, reason: "Gateway restricted during lockdown" };
      }
      break;
    case "tools":
      if (lockdownState.restrictions.toolsDisabled) {
        return { allowed: false, reason: "Tool execution disabled during lockdown" };
      }
      break;
  }

  return { allowed: true };
}

// ============================================================================
// EMERGENCY MODE
// ============================================================================

/**
 * Activate emergency mode (maximum restrictions)
 */
export function activateEmergencyMode(reason: string): void {
  activateLockdown({
    reason: `EMERGENCY: ${reason}`,
    activatedBy: "system",
    restrictions: {
      adminOnly: true,
      chatDisabled: true,
      gatewayRestricted: true,
      toolsDisabled: true,
    },
  });

  log.error(`EMERGENCY MODE ACTIVATED: ${reason}`);
}

// Initialize emergency mode from env
if (LOCKDOWN_CONFIG.emergencyMode) {
  activateEmergencyMode("Environment variable SECURITY_EMERGENCY=true");
}
