/**
 * Security Initialization - SUPER SUPREME GOD MODE
 *
 * Initializes all security modules at application startup.
 * MUST be called before any tool execution or message handling.
 */

import { initializeSecurityControls, getSecurityStatus } from "../kill-switch.js";
import { resetRunUsage } from "../cost-controls.js";

let initialized = false;

/**
 * Initializes the security subsystem.
 * Should be called once at application startup.
 */
export function initializeSecurity(): void {
  if (initialized) return;

  // Initialize kill switch and lockdown from environment
  initializeSecurityControls();

  // Reset run-level usage counters
  resetRunUsage();

  // Log security status
  const status = getSecurityStatus();
  if (status.killSwitch.enabled) {
    console.warn("[SECURITY] KILL SWITCH IS ACTIVE - All tool execution disabled");
  }
  if (status.lockdown.enabled) {
    console.warn("[SECURITY] LOCKDOWN MODE IS ACTIVE - Strict confirmations required");
  }

  initialized = true;
  console.log("[SECURITY] Security subsystem initialized");
}

/**
 * Checks if security is initialized.
 */
export function isSecurityInitialized(): boolean {
  return initialized;
}

/**
 * Resets security initialization (for testing).
 */
export function resetSecurityInit(): void {
  initialized = false;
}
