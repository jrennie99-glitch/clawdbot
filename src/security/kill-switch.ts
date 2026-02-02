/**
 * Kill Switch & Lockdown Mode - SUPER SUPREME GOD MODE
 * 
 * Emergency controls for immediate security response.
 * - Kill Switch: Disables ALL tool execution and external communication
 * - Lockdown Mode: Strict confirmation requirements
 */

import type { KillSwitchState, LockdownConfig } from './types.js';
import { nowIso } from './utils.js';

// ============================================================================
// KILL SWITCH
// ============================================================================

let killSwitchState: KillSwitchState = {
  enabled: process.env.KILL_SWITCH === 'true',
  activatedAt: process.env.KILL_SWITCH === 'true' ? new Date() : undefined,
  reason: process.env.KILL_SWITCH === 'true' ? 'Environment variable' : undefined,
};

/**
 * Gets the current kill switch state.
 */
export function getKillSwitchState(): KillSwitchState {
  return { ...killSwitchState };
}

/**
 * Activates the kill switch.
 * SECURITY: This immediately disables all tool execution.
 */
export function activateKillSwitch(params?: { reason?: string; activatedBy?: string }): void {
  killSwitchState = {
    enabled: true,
    activatedAt: new Date(),
    activatedBy: params?.activatedBy,
    reason: params?.reason ?? 'Manual activation',
  };
  
  // Log to console for visibility
  console.error('[SECURITY] KILL SWITCH ACTIVATED:', {
    time: nowIso(),
    reason: killSwitchState.reason,
    activatedBy: killSwitchState.activatedBy,
  });
}

/**
 * Deactivates the kill switch.
 * SECURITY: Only allow deactivation with explicit confirmation.
 */
export function deactivateKillSwitch(params: { deactivatedBy: string; confirmCode: string }): boolean {
  // Require a confirmation code to prevent accidental deactivation
  // In production, this should validate against a secure source
  const expectedCode = process.env.KILL_SWITCH_CONFIRM_CODE ?? 'CONFIRM_DEACTIVATE';
  
  if (params.confirmCode !== expectedCode) {
    console.error('[SECURITY] Kill switch deactivation FAILED - invalid confirmation code');
    return false;
  }
  
  console.warn('[SECURITY] Kill switch deactivated by:', params.deactivatedBy);
  
  killSwitchState = {
    enabled: false,
  };
  
  return true;
}

/**
 * Checks if kill switch is active.
 */
export function isKillSwitchActive(): boolean {
  return killSwitchState.enabled;
}

// ============================================================================
// LOCKDOWN MODE
// ============================================================================

const DEFAULT_LOCKDOWN_ALLOWLIST = [
  // Safe domains for basic operation
  'api.anthropic.com',
  'api.openai.com',
  'api.moonshot.cn',
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  // Standard safe domains
  'github.com',
  'raw.githubusercontent.com',
];

let lockdownConfig: LockdownConfig = {
  enabled: process.env.LOCKDOWN_MODE === 'true',
  externalCommsConfirm: true,
  writesDeletesConfirm: true,
  shellBrowserDeny: true,
  outboundNetworkAllowlist: DEFAULT_LOCKDOWN_ALLOWLIST,
};

/**
 * Gets the current lockdown configuration.
 */
export function getLockdownConfig(): LockdownConfig {
  return { ...lockdownConfig };
}

/**
 * Enables lockdown mode.
 */
export function enableLockdownMode(config?: Partial<LockdownConfig>): void {
  lockdownConfig = {
    enabled: true,
    externalCommsConfirm: config?.externalCommsConfirm ?? true,
    writesDeletesConfirm: config?.writesDeletesConfirm ?? true,
    shellBrowserDeny: config?.shellBrowserDeny ?? true,
    outboundNetworkAllowlist: config?.outboundNetworkAllowlist ?? DEFAULT_LOCKDOWN_ALLOWLIST,
  };
  
  console.warn('[SECURITY] LOCKDOWN MODE ENABLED:', {
    time: nowIso(),
    config: lockdownConfig,
  });
}

/**
 * Disables lockdown mode.
 */
export function disableLockdownMode(): void {
  console.warn('[SECURITY] Lockdown mode disabled:', nowIso());
  lockdownConfig = {
    ...lockdownConfig,
    enabled: false,
  };
}

/**
 * Checks if lockdown mode is enabled.
 */
export function isLockdownModeEnabled(): boolean {
  return lockdownConfig.enabled;
}

/**
 * Adds domains to the lockdown allowlist.
 */
export function addToLockdownAllowlist(domains: string[]): void {
  const normalized = domains.map(d => d.toLowerCase().trim()).filter(Boolean);
  lockdownConfig.outboundNetworkAllowlist = [
    ...new Set([...lockdownConfig.outboundNetworkAllowlist, ...normalized]),
  ];
}

/**
 * Removes domains from the lockdown allowlist.
 */
export function removeFromLockdownAllowlist(domains: string[]): void {
  const toRemove = new Set(domains.map(d => d.toLowerCase().trim()));
  lockdownConfig.outboundNetworkAllowlist = lockdownConfig.outboundNetworkAllowlist.filter(
    d => !toRemove.has(d)
  );
}

// ============================================================================
// COMBINED STATUS
// ============================================================================

export type SecurityStatus = {
  killSwitch: KillSwitchState;
  lockdown: LockdownConfig;
  canExecuteTools: boolean;
  canSendExternal: boolean;
  canAccessNetwork: boolean;
};

/**
 * Gets the combined security status.
 */
export function getSecurityStatus(): SecurityStatus {
  return {
    killSwitch: getKillSwitchState(),
    lockdown: getLockdownConfig(),
    canExecuteTools: !killSwitchState.enabled,
    canSendExternal: !killSwitchState.enabled && (!lockdownConfig.enabled || !lockdownConfig.externalCommsConfirm),
    canAccessNetwork: !killSwitchState.enabled,
  };
}

/**
 * Initializes security controls from environment.
 */
export function initializeSecurityControls(): void {
  // Kill switch from env
  if (process.env.KILL_SWITCH === 'true') {
    activateKillSwitch({ reason: 'Environment variable KILL_SWITCH=true' });
  }
  
  // Lockdown from env
  if (process.env.LOCKDOWN_MODE === 'true') {
    enableLockdownMode();
  }
  
  // Custom allowlist from env
  const customAllowlist = process.env.LOCKDOWN_NETWORK_ALLOWLIST;
  if (customAllowlist) {
    const domains = customAllowlist.split(',').map(d => d.trim()).filter(Boolean);
    if (domains.length > 0) {
      addToLockdownAllowlist(domains);
    }
  }
}
