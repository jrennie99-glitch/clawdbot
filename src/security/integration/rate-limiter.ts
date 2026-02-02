/**
 * Rate Limiter Runtime - SUPER SUPREME GOD MODE
 *
 * Real runtime enforcement of rate limiting.
 * Enforces limits on messages, tool calls, and LLM requests.
 */

import { TokenBucket } from "../utils.js";
import { recordToolCall } from "../cost-controls.js";

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

const DEFAULT_LIMITS = {
  messages: {
    perUser: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_USER ?? "60", 10), // per minute
    perIp: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_IP ?? "100", 10),
    global: parseInt(process.env.RATE_LIMIT_MESSAGES_GLOBAL ?? "1000", 10),
  },
  toolCalls: {
    perRun: parseInt(process.env.RATE_LIMIT_TOOLS_PER_RUN ?? "100", 10),
    perMinute: parseInt(process.env.RATE_LIMIT_TOOLS_PER_MINUTE ?? "30", 10),
  },
  llmCalls: {
    perMinute: parseInt(process.env.RATE_LIMIT_LLM_PER_MINUTE ?? "20", 10),
    perHour: parseInt(process.env.RATE_LIMIT_LLM_PER_HOUR ?? "500", 10),
  },
};

// ============================================================================
// RATE LIMITERS
// ============================================================================

/** Per-user message rate limiters */
const userMessageLimiters = new Map<string, TokenBucket>();

/** Per-IP message rate limiters */
const ipMessageLimiters = new Map<string, TokenBucket>();

/** Global message rate limiter */
const globalMessageLimiter = new TokenBucket(DEFAULT_LIMITS.messages.global, 50);

/** Tool call rate limiter (per minute) */
const toolCallLimiter = new TokenBucket(DEFAULT_LIMITS.toolCalls.perMinute, 1);

/** LLM call rate limiters */
const llmMinuteLimiter = new TokenBucket(DEFAULT_LIMITS.llmCalls.perMinute, 0.5);
const llmHourLimiter = new TokenBucket(DEFAULT_LIMITS.llmCalls.perHour, 2);

/** Run-level tool call counter */
let runToolCallCount = 0;

// ============================================================================
// MESSAGE RATE LIMITING
// ============================================================================

export type RateLimitDecision = {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  limiterType?: "user" | "ip" | "global";
};

/**
 * Checks message rate limits.
 * Call this for every incoming message.
 */
export function checkMessageRateLimit(params: { userId?: string; ip?: string }): RateLimitDecision {
  // Global rate limit
  if (!globalMessageLimiter.consume(1)) {
    return {
      allowed: false,
      reason: "Global message rate limit exceeded",
      retryAfterMs: 1000,
      limiterType: "global",
    };
  }

  // User rate limit
  if (params.userId) {
    let limiter = userMessageLimiters.get(params.userId);
    if (!limiter) {
      limiter = new TokenBucket(DEFAULT_LIMITS.messages.perUser, 1);
      userMessageLimiters.set(params.userId, limiter);
    }
    if (!limiter.consume(1)) {
      return {
        allowed: false,
        reason: `User ${params.userId} rate limited`,
        retryAfterMs: 5000,
        limiterType: "user",
      };
    }
  }

  // IP rate limit
  if (params.ip) {
    let limiter = ipMessageLimiters.get(params.ip);
    if (!limiter) {
      limiter = new TokenBucket(DEFAULT_LIMITS.messages.perIp, 2);
      ipMessageLimiters.set(params.ip, limiter);
    }
    if (!limiter.consume(1)) {
      return {
        allowed: false,
        reason: `IP ${params.ip} rate limited`,
        retryAfterMs: 10000,
        limiterType: "ip",
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// TOOL CALL RATE LIMITING
// ============================================================================

/**
 * Checks tool call rate limits.
 * Call this before every tool execution.
 */
export function checkToolCallRateLimit(): RateLimitDecision {
  // Per-run limit
  if (runToolCallCount >= DEFAULT_LIMITS.toolCalls.perRun) {
    return {
      allowed: false,
      reason: `Tool call limit per run exceeded (${DEFAULT_LIMITS.toolCalls.perRun})`,
    };
  }

  // Per-minute limit
  if (!toolCallLimiter.consume(1)) {
    return {
      allowed: false,
      reason: "Tool call rate limit exceeded (per minute)",
      retryAfterMs: 2000,
    };
  }

  // Increment counter and record
  runToolCallCount++;
  recordToolCall();

  return { allowed: true };
}

/**
 * Resets run-level tool call counter.
 * Call at the start of each new run/session.
 */
export function resetRunToolCallCount(): void {
  runToolCallCount = 0;
}

/**
 * Gets current run tool call count.
 */
export function getRunToolCallCount(): number {
  return runToolCallCount;
}

// ============================================================================
// LLM CALL RATE LIMITING
// ============================================================================

/**
 * Checks LLM call rate limits.
 * Call this before every LLM request.
 */
export function checkLLMCallRateLimit(): RateLimitDecision {
  // Per-minute limit
  if (!llmMinuteLimiter.consume(1)) {
    return {
      allowed: false,
      reason: "LLM call rate limit exceeded (per minute)",
      retryAfterMs: 3000,
    };
  }

  // Per-hour limit
  if (!llmHourLimiter.consume(1)) {
    return {
      allowed: false,
      reason: "LLM call rate limit exceeded (per hour)",
      retryAfterMs: 60000,
    };
  }

  return { allowed: true };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleans up stale rate limiters to prevent memory leaks.
 */
export function cleanupRateLimiters(): number {
  let cleaned = 0;

  // Clean up if maps get too large
  if (userMessageLimiters.size > 10000) {
    userMessageLimiters.clear();
    cleaned += 10000;
  }

  if (ipMessageLimiters.size > 10000) {
    ipMessageLimiters.clear();
    cleaned += 10000;
  }

  return cleaned;
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Gets rate limiter status for monitoring.
 */
export function getRateLimiterStatus(): {
  userLimiters: number;
  ipLimiters: number;
  runToolCalls: number;
  limits: typeof DEFAULT_LIMITS;
} {
  return {
    userLimiters: userMessageLimiters.size,
    ipLimiters: ipMessageLimiters.size,
    runToolCalls: runToolCallCount,
    limits: DEFAULT_LIMITS,
  };
}
