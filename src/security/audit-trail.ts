/**
 * Audit Trail - SUPER SUPREME GOD MODE
 *
 * Read-only execution replay and audit logging.
 */

import { redactSecrets } from "./secret-redaction.js";

// ============================================================================
// TYPES
// ============================================================================

export type AuditEventType =
  | "run_start"
  | "input_received"
  | "policy_decision"
  | "tool_call"
  | "llm_call"
  | "output_generated"
  | "run_complete"
  | "error";

export type AuditEntry = {
  id: string;
  runId: string;
  timestamp: string;
  eventType: AuditEventType;
  userId?: string;
  orgId?: string;
  sessionKey?: string;

  // Event-specific data (secrets redacted)
  input?: string;
  tool?: string;
  action?: string;
  policyDecision?: "allow" | "deny" | "confirm";
  policyReason?: string;
  riskLevel?: string;
  llmModel?: string;
  llmProvider?: string;
  tokenCount?: number;
  costUsd?: number;
  output?: string;
  error?: string;
  durationMs?: number;
};

export type RunSummary = {
  runId: string;
  userId?: string;
  orgId?: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "denied";
  totalCostUsd: number;
  totalTokens: number;
  toolCalls: number;
  llmCalls: number;
  policyDenials: number;
  riskLevel: string;
};

// ============================================================================
// STORAGE
// ============================================================================

const auditLog: AuditEntry[] = [];
const runSummaries = new Map<string, RunSummary>();
const MAX_AUDIT_ENTRIES = 10000;
const MAX_RUNS = 1000;

// ============================================================================
// AUDIT LOGGING
// ============================================================================

let entryCounter = 0;

function generateId(): string {
  return `audit_${Date.now()}_${++entryCounter}`;
}

/**
 * Logs an audit entry. All secrets are automatically redacted.
 */
export function logAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const fullEntry: AuditEntry = {
    ...entry,
    id: generateId(),
    timestamp: new Date().toISOString(),
    // Redact any secrets in string fields
    input: entry.input ? redactSecrets(entry.input).redacted : undefined,
    output: entry.output ? redactSecrets(entry.output).redacted : undefined,
    error: entry.error ? redactSecrets(entry.error).redacted : undefined,
  };

  auditLog.unshift(fullEntry);

  // Trim to max size
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.pop();
  }

  // Update run summary
  updateRunSummary(fullEntry);

  return fullEntry;
}

/**
 * Updates run summary based on audit entry.
 */
function updateRunSummary(entry: AuditEntry): void {
  let summary = runSummaries.get(entry.runId);

  if (!summary) {
    summary = {
      runId: entry.runId,
      userId: entry.userId,
      orgId: entry.orgId,
      startedAt: entry.timestamp,
      status: "running",
      totalCostUsd: 0,
      totalTokens: 0,
      toolCalls: 0,
      llmCalls: 0,
      policyDenials: 0,
      riskLevel: "low",
    };
    runSummaries.set(entry.runId, summary);

    // Trim old runs
    if (runSummaries.size > MAX_RUNS) {
      const oldest = Array.from(runSummaries.keys())[0];
      if (oldest) runSummaries.delete(oldest);
    }
  }

  // Update based on event type
  switch (entry.eventType) {
    case "tool_call":
      summary.toolCalls++;
      break;
    case "llm_call":
      summary.llmCalls++;
      if (entry.tokenCount) summary.totalTokens += entry.tokenCount;
      if (entry.costUsd) summary.totalCostUsd += entry.costUsd;
      break;
    case "policy_decision":
      if (entry.policyDecision === "deny") summary.policyDenials++;
      if (entry.riskLevel) {
        const levels = ["low", "medium", "high", "critical"];
        if (levels.indexOf(entry.riskLevel) > levels.indexOf(summary.riskLevel)) {
          summary.riskLevel = entry.riskLevel;
        }
      }
      break;
    case "run_complete":
      summary.status = "completed";
      summary.completedAt = entry.timestamp;
      break;
    case "error":
      summary.status = "failed";
      summary.completedAt = entry.timestamp;
      break;
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Gets audit entries for a specific run (replay).
 */
export function getRunAuditTrail(runId: string): AuditEntry[] {
  return auditLog.filter((e) => e.runId === runId).reverse(); // Chronological order
}

/**
 * Gets run summary.
 */
export function getRunSummary(runId: string): RunSummary | undefined {
  return runSummaries.get(runId);
}

/**
 * Lists runs with optional filters.
 */
export function listRuns(params: {
  userId?: string;
  orgId?: string;
  status?: RunSummary["status"];
  riskLevel?: string;
  limit?: number;
  offset?: number;
}): { runs: RunSummary[]; total: number } {
  let filtered = Array.from(runSummaries.values());

  if (params.userId) {
    filtered = filtered.filter((r) => r.userId === params.userId);
  }
  if (params.orgId) {
    filtered = filtered.filter((r) => r.orgId === params.orgId);
  }
  if (params.status) {
    filtered = filtered.filter((r) => r.status === params.status);
  }
  if (params.riskLevel) {
    filtered = filtered.filter((r) => r.riskLevel === params.riskLevel);
  }

  // Sort by start time descending
  filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const total = filtered.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  return {
    runs: filtered.slice(offset, offset + limit),
    total,
  };
}

/**
 * Gets recent audit entries with optional filters.
 */
export function getAuditLog(params: {
  runId?: string;
  userId?: string;
  orgId?: string;
  eventType?: AuditEventType;
  limit?: number;
}): AuditEntry[] {
  let filtered = auditLog;

  if (params.runId) {
    filtered = filtered.filter((e) => e.runId === params.runId);
  }
  if (params.userId) {
    filtered = filtered.filter((e) => e.userId === params.userId);
  }
  if (params.orgId) {
    filtered = filtered.filter((e) => e.orgId === params.orgId);
  }
  if (params.eventType) {
    filtered = filtered.filter((e) => e.eventType === params.eventType);
  }

  return filtered.slice(0, params.limit ?? 100);
}

/**
 * Exports audit trail as JSON (secrets already redacted).
 */
export function exportAuditTrail(runId: string): string {
  const entries = getRunAuditTrail(runId);
  const summary = getRunSummary(runId);

  return JSON.stringify(
    {
      runId,
      summary,
      entries,
      exportedAt: new Date().toISOString(),
      notice: "All secrets have been automatically redacted",
    },
    null,
    2,
  );
}

/**
 * Gets audit statistics.
 */
export function getAuditStats(): {
  totalRuns: number;
  totalEntries: number;
  runsByStatus: Record<string, number>;
  runsByRisk: Record<string, number>;
} {
  const runsByStatus: Record<string, number> = {};
  const runsByRisk: Record<string, number> = {};

  for (const run of runSummaries.values()) {
    runsByStatus[run.status] = (runsByStatus[run.status] ?? 0) + 1;
    runsByRisk[run.riskLevel] = (runsByRisk[run.riskLevel] ?? 0) + 1;
  }

  return {
    totalRuns: runSummaries.size,
    totalEntries: auditLog.length,
    runsByStatus,
    runsByRisk,
  };
}
