/**
 * Skill Sandbox - SUPER SUPREME GOD MODE
 *
 * Runtime isolation for skill execution.
 * Enforces permission manifests and prevents unauthorized access.
 */

import type { SkillPermission, SkillManifest, SkillExecutionContext } from "../types.js";

// ============================================================================
// PERMISSION ENFORCEMENT
// ============================================================================

/**
 * Default permissions (very restrictive)
 */
const DEFAULT_PERMISSIONS: SkillPermission[] = [];

/**
 * Validates a skill manifest.
 */
export function validateSkillManifest(manifest: SkillManifest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!manifest.id || typeof manifest.id !== "string") {
    errors.push("Skill must have a valid id");
  }

  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push("Skill must have a valid name");
  }

  if (!manifest.version || typeof manifest.version !== "string") {
    errors.push("Skill must have a valid version");
  }

  if (!Array.isArray(manifest.permissions)) {
    errors.push("Skill must declare permissions array");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a skill has a specific permission.
 */
export function hasPermission(manifest: SkillManifest, permission: SkillPermission): boolean {
  return manifest.permissions.includes(permission);
}

/**
 * Creates an execution context for a skill.
 */
export function createSkillExecutionContext(
  manifest: SkillManifest,
  options?: {
    timeout?: number;
    memoryQuota?: number;
    networkAllowlist?: string[];
  },
): SkillExecutionContext {
  const sandboxId = `sandbox_${manifest.id}_${Date.now()}`;

  return {
    skillId: manifest.id,
    manifest,
    sandboxId,
    timeout: options?.timeout ?? 30000, // 30 second default
    memoryQuota: options?.memoryQuota ?? 50 * 1024 * 1024, // 50MB default
    networkAllowlist: hasPermission(manifest, "network") ? (options?.networkAllowlist ?? []) : [],
  };
}

// ============================================================================
// CAPABILITY GUARDS
// ============================================================================

export type CapabilityCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Checks if a skill can access the network.
 */
export function canAccessNetwork(
  context: SkillExecutionContext,
  domain: string,
): CapabilityCheckResult {
  if (!hasPermission(context.manifest, "network")) {
    return {
      allowed: false,
      reason: "Skill does not have network permission",
    };
  }

  if (context.networkAllowlist && context.networkAllowlist.length > 0) {
    const allowed = context.networkAllowlist.some(
      (pattern) => domain === pattern || domain.endsWith("." + pattern),
    );
    if (!allowed) {
      return {
        allowed: false,
        reason: `Domain ${domain} not in skill's network allowlist`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks if a skill can access the filesystem.
 */
export function canAccessFilesystem(
  context: SkillExecutionContext,
  path: string,
): CapabilityCheckResult {
  if (!hasPermission(context.manifest, "filesystem")) {
    return {
      allowed: false,
      reason: "Skill does not have filesystem permission",
    };
  }

  // Skills can only access their own sandbox directory
  const skillDir = `/tmp/skills/${context.manifest.id}`;
  if (!path.startsWith(skillDir)) {
    return {
      allowed: false,
      reason: `Skill can only access files in ${skillDir}`,
    };
  }

  return { allowed: true };
}

/**
 * Checks if a skill can execute shell commands.
 */
export function canExecuteShell(context: SkillExecutionContext): CapabilityCheckResult {
  if (!hasPermission(context.manifest, "shell")) {
    return {
      allowed: false,
      reason: "Skill does not have shell permission",
    };
  }

  // Additional safety: shell is only allowed for trusted skills
  if (!context.manifest.trustedSource) {
    return {
      allowed: false,
      reason: "Shell access requires trusted skill source",
    };
  }

  return { allowed: true };
}

/**
 * Checks if a skill can send messages.
 */
export function canSendMessage(context: SkillExecutionContext): CapabilityCheckResult {
  if (!hasPermission(context.manifest, "send_message")) {
    return {
      allowed: false,
      reason: "Skill does not have send_message permission",
    };
  }

  return { allowed: true };
}

/**
 * Checks if a skill can read memory.
 */
export function canReadMemory(context: SkillExecutionContext): CapabilityCheckResult {
  if (!hasPermission(context.manifest, "memory_read")) {
    return {
      allowed: false,
      reason: "Skill does not have memory_read permission",
    };
  }

  return { allowed: true };
}

/**
 * Checks if a skill can write to memory.
 */
export function canWriteMemory(context: SkillExecutionContext): CapabilityCheckResult {
  if (!hasPermission(context.manifest, "memory_write")) {
    return {
      allowed: false,
      reason: "Skill does not have memory_write permission",
    };
  }

  return { allowed: true };
}

// ============================================================================
// SKILL OUTPUT QUARANTINE
// ============================================================================

import { quarantineContent } from "../trust-zones.js";

/**
 * Quarantines skill output before it can influence the system.
 */
export function quarantineSkillOutput(
  context: SkillExecutionContext,
  output: string,
): { quarantineId: string; sanitized: string } {
  const entry = quarantineContent({
    content: output,
    source: "skill",
    metadata: {
      skillId: context.skillId,
      sandboxId: context.sandboxId,
    },
  });

  return {
    quarantineId: entry.id,
    sanitized: entry.sanitizedContent ?? "",
  };
}

// ============================================================================
// ACTIVE SKILL TRACKING
// ============================================================================

const activeSkills = new Map<string, SkillExecutionContext>();

/**
 * Registers an active skill execution.
 */
export function registerSkillExecution(context: SkillExecutionContext): void {
  activeSkills.set(context.sandboxId!, context);
}

/**
 * Unregisters a skill execution.
 */
export function unregisterSkillExecution(sandboxId: string): void {
  activeSkills.delete(sandboxId);
}

/**
 * Gets all active skill executions.
 */
export function getActiveSkills(): SkillExecutionContext[] {
  return Array.from(activeSkills.values());
}

/**
 * Terminates all active skills (emergency shutdown).
 */
export function terminateAllSkills(): number {
  const count = activeSkills.size;
  activeSkills.clear();
  return count;
}
