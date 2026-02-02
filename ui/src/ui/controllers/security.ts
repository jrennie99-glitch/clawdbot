/**
 * Security Dashboard Controller
 */

import type { MoltbotApp } from "../app.js";

export interface SecurityStatus {
  killSwitch: { enabled: boolean; activatedAt?: string; reason?: string };
  lockdown: { enabled: boolean };
  budget: { daily: number; perRun: number; tokensPerRun: number; toolCallsPerRun: number };
  usage: { dailyCost: number; runCost: number; runTokens: number; runToolCalls: number };
  budgetStatus: { dailyRemaining: number; runRemaining: number; atLimit: boolean; nearLimit: boolean };
  rateLimits: { userLimiters: number; ipLimiters: number; runToolCalls: number };
  providers: string[];
}

export interface PolicyDecision {
  timestamp: string;
  tool: string;
  action?: string;
  decision: string;
  reason: string;
  userId?: string;
}

export interface PendingApproval {
  previewId: string;
  tool: string;
  action?: string;
  parameters?: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface AttackEntry {
  timestamp: string;
  source: string;
  userId?: string;
  patterns: Array<{ pattern: string; severity: string }>;
  blocked: boolean;
}

export interface QuarantineEntry {
  id: string;
  source: string;
  trustLevel: string;
  timestamp: string;
  expiresAt: string;
  contentPreview: string;
}

export interface CostStatus {
  tier: string;
  dailyCost: string;
  runCost: string;
  dailyLimit: string;
  runLimit: string;
  providers: Array<{ id: string; status: string }>;
}

export async function loadSecurityStatus(state: MoltbotApp): Promise<SecurityStatus | null> {
  if (!state.client) return null;
  try {
    const res = await state.client.request("security.status", {});
    return res as SecurityStatus;
  } catch (err) {
    console.error("Failed to load security status:", err);
    return null;
  }
}

export async function toggleKillSwitch(
  state: MoltbotApp,
  enabled: boolean,
  confirmCode?: string,
): Promise<boolean> {
  if (!state.client) return false;
  try {
    await state.client.request("security.killswitch.set", { enabled, confirmCode });
    return true;
  } catch (err) {
    console.error("Failed to toggle kill switch:", err);
    return false;
  }
}

export async function toggleLockdown(state: MoltbotApp, enabled: boolean): Promise<boolean> {
  if (!state.client) return false;
  try {
    await state.client.request("security.lockdown.set", { enabled });
    return true;
  } catch (err) {
    console.error("Failed to toggle lockdown:", err);
    return false;
  }
}

export async function loadPolicyDecisions(
  state: MoltbotApp,
  limit = 50,
): Promise<PolicyDecision[]> {
  if (!state.client) return [];
  try {
    const res = (await state.client.request("security.decisions.list", { limit })) as {
      decisions: PolicyDecision[];
    };
    return res.decisions ?? [];
  } catch (err) {
    console.error("Failed to load policy decisions:", err);
    return [];
  }
}

export async function loadPendingApprovals(state: MoltbotApp): Promise<PendingApproval[]> {
  if (!state.client) return [];
  try {
    const res = (await state.client.request("security.pending.list", {})) as {
      pending: PendingApproval[];
    };
    return res.pending ?? [];
  } catch (err) {
    console.error("Failed to load pending approvals:", err);
    return [];
  }
}

export async function approvePending(state: MoltbotApp, previewId: string): Promise<boolean> {
  if (!state.client) return false;
  try {
    await state.client.request("security.pending.approve", { previewId });
    return true;
  } catch (err) {
    console.error("Failed to approve:", err);
    return false;
  }
}

export async function denyPending(
  state: MoltbotApp,
  previewId: string,
  reason?: string,
): Promise<boolean> {
  if (!state.client) return false;
  try {
    await state.client.request("security.pending.deny", { previewId, reason });
    return true;
  } catch (err) {
    console.error("Failed to deny:", err);
    return false;
  }
}

export async function loadAttacks(state: MoltbotApp, limit = 50): Promise<AttackEntry[]> {
  if (!state.client) return [];
  try {
    const res = (await state.client.request("security.attacks.list", { limit })) as {
      attacks: AttackEntry[];
    };
    return res.attacks ?? [];
  } catch (err) {
    console.error("Failed to load attacks:", err);
    return [];
  }
}

export async function loadQuarantine(state: MoltbotApp): Promise<QuarantineEntry[]> {
  if (!state.client) return [];
  try {
    const res = (await state.client.request("security.quarantine.list", {})) as {
      entries: QuarantineEntry[];
    };
    return res.entries ?? [];
  } catch (err) {
    console.error("Failed to load quarantine:", err);
    return [];
  }
}

export async function deleteQuarantineEntry(state: MoltbotApp, id: string): Promise<boolean> {
  if (!state.client) return false;
  try {
    await state.client.request("security.quarantine.delete", { id });
    return true;
  } catch (err) {
    console.error("Failed to delete quarantine entry:", err);
    return false;
  }
}

export async function loadCostStatus(state: MoltbotApp): Promise<CostStatus | null> {
  if (!state.client) return null;
  try {
    const res = await state.client.request("security.cost.status", {});
    return res as CostStatus;
  } catch (err) {
    console.error("Failed to load cost status:", err);
    return null;
  }
}
