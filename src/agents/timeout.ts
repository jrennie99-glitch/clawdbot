import type { MoltbotConfig } from "../config/config.js";
import { DEFAULT_LLM_TIMEOUT_MS } from "./defaults.js";

// Default to a much shorter timeout (15s) for faster failure detection
// The old 600s default caused stuck requests with cheaper providers
const DEFAULT_AGENT_TIMEOUT_SECONDS = Math.floor(DEFAULT_LLM_TIMEOUT_MS / 1000);

const normalizeNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;

export function resolveAgentTimeoutSeconds(cfg?: MoltbotConfig): number {
  const raw = normalizeNumber(cfg?.agents?.defaults?.timeoutSeconds);
  const seconds = raw ?? DEFAULT_AGENT_TIMEOUT_SECONDS;
  return Math.max(seconds, 1);
}

export function resolveAgentTimeoutMs(opts: {
  cfg?: MoltbotConfig;
  overrideMs?: number | null;
  overrideSeconds?: number | null;
  minMs?: number;
}): number {
  const minMs = Math.max(normalizeNumber(opts.minMs) ?? 1, 1);
  const defaultMs = resolveAgentTimeoutSeconds(opts.cfg) * 1000;
  const overrideMs = normalizeNumber(opts.overrideMs);
  if (overrideMs !== undefined) {
    if (overrideMs <= 0) return defaultMs;
    return Math.max(overrideMs, minMs);
  }
  const overrideSeconds = normalizeNumber(opts.overrideSeconds);
  if (overrideSeconds !== undefined) {
    if (overrideSeconds <= 0) return defaultMs;
    return Math.max(overrideSeconds * 1000, minMs);
  }
  return Math.max(defaultMs, minMs);
}
