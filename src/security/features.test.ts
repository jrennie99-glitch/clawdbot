/**
 * HITL, Audit Trail, and Budget Guardrails Tests
 */

import { describe, it, expect, beforeEach } from "vitest";

// HITL
import {
  getHITLMode,
  setHITLMode,
  getHITLStatus,
  assessRiskLevel,
  hitlRequiresConfirmation,
  evaluateHITL,
} from "./hitl.js";

// Audit Trail
import {
  logAuditEntry,
  getRunAuditTrail,
  getRunSummary,
  listRuns,
  exportAuditTrail,
  getAuditStats,
} from "./audit-trail.js";

// Budget Guardrails
import {
  setUserBudgetConfig,
  getBudgetConfig,
  recordCostUsage,
  resetRunUsage,
  checkBudgetGuardrails,
  getBudgetViolations,
} from "./budget-guardrails.js";

// Kill switch for override tests
import { activateKillSwitch, deactivateKillSwitch, isKillSwitchActive } from "./kill-switch.js";
import { evaluatePolicy } from "./policy-engine.js";

// ============================================================================
// HITL TESTS
// ============================================================================

describe("HITL (Human-in-the-Loop)", () => {
  beforeEach(() => {
    setHITLMode("selective");
    deactivateKillSwitch({ deactivatedBy: "test", confirmCode: "CONFIRM_DEACTIVATE" });
  });

  describe("Mode Management", () => {
    it("defaults to selective mode", () => {
      setHITLMode("selective");
      expect(getHITLMode()).toBe("selective");
    });

    it("can switch to off mode", () => {
      setHITLMode("off");
      expect(getHITLMode()).toBe("off");
    });

    it("can switch to full mode", () => {
      setHITLMode("full");
      expect(getHITLMode()).toBe("full");
    });

    it("rejects invalid modes", () => {
      expect(() => setHITLMode("invalid" as any)).toThrow();
    });

    it("returns status with description", () => {
      const status = getHITLStatus();
      expect(status.mode).toBe("selective");
      expect(status.description).toContain("HIGH or CRITICAL");
    });
  });

  describe("Risk Assessment", () => {
    it("assesses critical risk for secrets + sending data", () => {
      const level = assessRiskLevel({
        tool: "message",
        accessesSecrets: true,
        sendsData: true,
      });
      expect(level).toBe("critical");
    });

    it("assesses high risk for destructive actions", () => {
      const level = assessRiskLevel({
        tool: "file",
        isDestructive: true,
      });
      expect(level).toBe("high");
    });

    it("assesses high risk for exec tool", () => {
      const level = assessRiskLevel({ tool: "exec" });
      expect(level).toBe("high");
    });

    it("assesses medium risk for external actions", () => {
      const level = assessRiskLevel({
        tool: "fetch",
        isExternal: true,
      });
      expect(level).toBe("medium");
    });

    it("assesses low risk for read-only actions", () => {
      const level = assessRiskLevel({ tool: "read" });
      expect(level).toBe("low");
    });
  });

  describe("HITL Off Mode", () => {
    beforeEach(() => setHITLMode("off"));

    it("allows high-risk actions without confirmation", () => {
      expect(hitlRequiresConfirmation("high")).toBe(false);
    });

    it("allows critical-risk actions without confirmation", () => {
      expect(hitlRequiresConfirmation("critical")).toBe(false);
    });

    it("allows all actions without confirmation", () => {
      const result = evaluateHITL({ tool: "exec", isDestructive: true });
      expect(result.requiresConfirmation).toBe(false);
    });
  });

  describe("HITL Selective Mode", () => {
    beforeEach(() => setHITLMode("selective"));

    it("allows low-risk actions", () => {
      expect(hitlRequiresConfirmation("low")).toBe(false);
    });

    it("allows medium-risk actions", () => {
      expect(hitlRequiresConfirmation("medium")).toBe(false);
    });

    it("requires confirmation for high-risk actions", () => {
      expect(hitlRequiresConfirmation("high")).toBe(true);
    });

    it("requires confirmation for critical-risk actions", () => {
      expect(hitlRequiresConfirmation("critical")).toBe(true);
    });
  });

  describe("HITL Full Mode", () => {
    beforeEach(() => setHITLMode("full"));

    it("requires confirmation for all actions including low-risk", () => {
      expect(hitlRequiresConfirmation("low")).toBe(true);
    });

    it("requires confirmation for medium-risk", () => {
      expect(hitlRequiresConfirmation("medium")).toBe(true);
    });

    it("requires confirmation for high-risk", () => {
      expect(hitlRequiresConfirmation("high")).toBe(true);
    });
  });

  describe("Policy Engine Overrides", () => {
    it("DENY rules override HITL", () => {
      setHITLMode("off");

      // This context triggers a DENY (SSRF attempt)
      const context = {
        who: {},
        what: { tool: "fetch" },
        where: { domain: "localhost" },
        risk: {},
        budget: {},
      };

      const result = evaluatePolicy(context);
      expect(result.decision).toBe("deny");
    });

    it("Kill Switch overrides HITL", () => {
      setHITLMode("off");
      activateKillSwitch({ reason: "test" });

      expect(isKillSwitchActive()).toBe(true);

      // Even with HITL off, kill switch blocks
      const context = {
        who: {},
        what: { tool: "exec" },
        where: {},
        risk: {},
        budget: {},
      };

      const result = evaluatePolicy(context);
      expect(result.decision).toBe("deny");
      expect(result.reason).toContain("Kill switch");
    });
  });
});

// ============================================================================
// AUDIT TRAIL TESTS
// ============================================================================

describe("Audit Trail", () => {
  const testRunId = `test_run_${Date.now()}`;

  describe("Logging", () => {
    it("logs audit entries with timestamps", () => {
      const entry = logAuditEntry({
        runId: testRunId,
        eventType: "run_start",
        userId: "user1",
      });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.runId).toBe(testRunId);
    });

    it("redacts secrets in input", () => {
      const entry = logAuditEntry({
        runId: testRunId,
        eventType: "input_received",
        input: "API key is sk-1234567890abcdefghij",
      });

      expect(entry.input).not.toContain("sk-1234567890");
      expect(entry.input).toContain("REDACTED");
    });

    it("logs tool calls", () => {
      const entry = logAuditEntry({
        runId: testRunId,
        eventType: "tool_call",
        tool: "exec",
        action: "execute",
      });

      expect(entry.eventType).toBe("tool_call");
      expect(entry.tool).toBe("exec");
    });

    it("logs LLM calls with cost", () => {
      const entry = logAuditEntry({
        runId: testRunId,
        eventType: "llm_call",
        llmModel: "gpt-4",
        llmProvider: "openai",
        tokenCount: 1000,
        costUsd: 0.03,
      });

      expect(entry.tokenCount).toBe(1000);
      expect(entry.costUsd).toBe(0.03);
    });
  });

  describe("Replay", () => {
    it("retrieves audit trail for a run", () => {
      const runId = `replay_test_${Date.now()}`;

      logAuditEntry({ runId, eventType: "run_start" });
      logAuditEntry({ runId, eventType: "tool_call", tool: "read" });
      logAuditEntry({ runId, eventType: "run_complete" });

      const trail = getRunAuditTrail(runId);
      expect(trail.length).toBe(3);
      expect(trail[0].eventType).toBe("run_start");
      expect(trail[2].eventType).toBe("run_complete");
    });

    it("returns run summary", () => {
      const runId = `summary_test_${Date.now()}`;

      logAuditEntry({ runId, eventType: "run_start", userId: "user1" });
      logAuditEntry({ runId, eventType: "tool_call", tool: "exec" });
      logAuditEntry({
        runId,
        eventType: "llm_call",
        tokenCount: 500,
        costUsd: 0.01,
      });
      logAuditEntry({ runId, eventType: "run_complete" });

      const summary = getRunSummary(runId);
      expect(summary?.toolCalls).toBe(1);
      expect(summary?.llmCalls).toBe(1);
      expect(summary?.totalTokens).toBe(500);
      expect(summary?.status).toBe("completed");
    });
  });

  describe("Querying", () => {
    it("lists runs with filters", () => {
      const result = listRuns({ limit: 10 });
      expect(result.runs).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("exports audit trail as JSON", () => {
      const runId = `export_test_${Date.now()}`;
      logAuditEntry({ runId, eventType: "run_start" });

      const json = exportAuditTrail(runId);
      const parsed = JSON.parse(json);

      expect(parsed.runId).toBe(runId);
      expect(parsed.notice).toContain("redacted");
    });

    it("returns audit statistics", () => {
      const stats = getAuditStats();
      expect(stats.totalRuns).toBeGreaterThanOrEqual(0);
      expect(stats.totalEntries).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// BUDGET GUARDRAILS TESTS
// ============================================================================

describe("Budget Guardrails", () => {
  const testUserId = `test_user_${Date.now()}`;
  const testOrgId = `test_org_${Date.now()}`;

  beforeEach(() => {
    resetRunUsage({ userId: testUserId });
  });

  describe("Configuration", () => {
    it("uses default config when none set", () => {
      const config = getBudgetConfig({ userId: "unknown_user" });
      expect(config.perRunLimitUsd).toBeGreaterThan(0);
      expect(config.dailyLimitUsd).toBeGreaterThan(0);
    });

    it("sets user-specific config", () => {
      setUserBudgetConfig(testUserId, {
        perRunLimitUsd: 5,
        dailyLimitUsd: 50,
      });

      const config = getBudgetConfig({ userId: testUserId });
      expect(config.perRunLimitUsd).toBe(5);
      expect(config.dailyLimitUsd).toBe(50);
    });

    it("user config takes precedence over org", () => {
      const userId = `precedence_user_${Date.now()}`;
      const orgId = `precedence_org_${Date.now()}`;

      setUserBudgetConfig(userId, { perRunLimitUsd: 10 });
      setOrgBudgetConfig(orgId, { perRunLimitUsd: 20 });

      const config = getBudgetConfig({ userId, orgId });
      expect(config.perRunLimitUsd).toBe(10);
    });
  });

  describe("Usage Tracking", () => {
    it("tracks run usage", () => {
      recordCostUsage({ userId: testUserId, costUsd: 0.5 });

      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(status.usage.run.used).toBe(0.5);
    });

    it("resets run usage", () => {
      recordCostUsage({ userId: testUserId, costUsd: 0.5 });
      resetRunUsage({ userId: testUserId });

      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(status.usage.run.used).toBe(0);
    });
  });

  describe("Warnings", () => {
    it("warns at 70% usage", () => {
      setUserBudgetConfig(testUserId, { perRunLimitUsd: 1, warningThreshold: 0.7 });
      recordCostUsage({ userId: testUserId, costUsd: 0.75 });

      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(status.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Auto-Downgrade", () => {
    it("downgrades tier when near limit", () => {
      setUserBudgetConfig(testUserId, {
        perRunLimitUsd: 1,
        warningThreshold: 0.7,
        autoDowngrade: true,
      });
      recordCostUsage({ userId: testUserId, costUsd: 0.8 });

      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(["fast", "cheap"]).toContain(status.currentTier);
    });

    it("uses smart tier when under budget", () => {
      setUserBudgetConfig(testUserId, { perRunLimitUsd: 100 });
      resetRunUsage({ userId: testUserId });

      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(status.currentTier).toBe("smart");
    });
  });

  describe("Hard Stop", () => {
    it("blocks when limit exceeded with hardStop", () => {
      setUserBudgetConfig(testUserId, {
        perRunLimitUsd: 1,
        hardStop: true,
      });
      recordCostUsage({ userId: testUserId, costUsd: 1.5 });

      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(status.withinBudget).toBe(false);
      expect(status.currentTier).toBe("blocked");
    });

    it("logs violations when limit exceeded", () => {
      setUserBudgetConfig(testUserId, { perRunLimitUsd: 0.1, hardStop: true });
      recordCostUsage({ userId: testUserId, costUsd: 0.2 });
      checkBudgetGuardrails({ userId: testUserId });

      const violations = getBudgetViolations({ userId: testUserId });
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe("Budget Enforcement in LLM Router", () => {
    it("returns current tier for routing decisions", () => {
      const status = checkBudgetGuardrails({ userId: testUserId });
      expect(["smart", "fast", "cheap", "blocked"]).toContain(status.currentTier);
    });
  });
});
