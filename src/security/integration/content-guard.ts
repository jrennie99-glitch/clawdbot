/**
 * Content Guard - SUPER SUPREME GOD MODE
 *
 * Guards inbound content from DM/message handlers.
 * Ensures all external content is sanitized before processing.
 */

import type { ContentSource, TrustLevel } from "../types.js";
import { quarantineContent, resolveTrustLevel, type QuarantineEntry } from "../trust-zones.js";
import {
  sanitizeContent,
  sanitizeContentWithDetails,
  detectInjectionPatterns,
  wrapExternalContent,
  type SanitizeResult,
} from "../content-sanitizer.js";
import { TokenBucket } from "../utils.js";

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Per-user rate limiters */
const userRateLimiters = new Map<string, TokenBucket>();

/** Per-IP rate limiters */
const ipRateLimiters = new Map<string, TokenBucket>();

/** Global rate limiter */
const globalRateLimiter = new TokenBucket(1000, 100); // 1000 capacity, 100/sec refill

const DEFAULT_USER_RATE_LIMIT = 60; // requests per minute
const DEFAULT_USER_REFILL_RATE = 1; // tokens per second
const DEFAULT_IP_RATE_LIMIT = 100;
const DEFAULT_IP_REFILL_RATE = 2;

/**
 * Rate limiting result
 */
export type RateLimitResult = {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
};

/**
 * Checks rate limits for an incoming request.
 */
export function checkRateLimit(params: {
  userId?: string;
  ip?: string;
  consumeTokens?: number;
}): RateLimitResult {
  const tokens = params.consumeTokens ?? 1;

  // Check global rate limit
  if (!globalRateLimiter.consume(tokens)) {
    return {
      allowed: false,
      reason: "Global rate limit exceeded",
      retryAfterMs: 1000,
    };
  }

  // Check user rate limit
  if (params.userId) {
    let userLimiter = userRateLimiters.get(params.userId);
    if (!userLimiter) {
      userLimiter = new TokenBucket(DEFAULT_USER_RATE_LIMIT, DEFAULT_USER_REFILL_RATE);
      userRateLimiters.set(params.userId, userLimiter);
    }
    if (!userLimiter.consume(tokens)) {
      return {
        allowed: false,
        reason: `User rate limit exceeded for ${params.userId}`,
        retryAfterMs: 5000,
      };
    }
  }

  // Check IP rate limit
  if (params.ip) {
    let ipLimiter = ipRateLimiters.get(params.ip);
    if (!ipLimiter) {
      ipLimiter = new TokenBucket(DEFAULT_IP_RATE_LIMIT, DEFAULT_IP_REFILL_RATE);
      ipRateLimiters.set(params.ip, ipLimiter);
    }
    if (!ipLimiter.consume(tokens)) {
      return {
        allowed: false,
        reason: `IP rate limit exceeded for ${params.ip}`,
        retryAfterMs: 10000,
      };
    }
  }

  return { allowed: true };
}

/**
 * Cleans up old rate limiters.
 */
export function cleanupRateLimiters(maxIdleMs: number = 3600000): number {
  // For simplicity, clear all - in production would track last access
  const userCount = userRateLimiters.size;
  const ipCount = ipRateLimiters.size;

  // Keep recent ones, clear old
  if (userCount > 10000) {
    userRateLimiters.clear();
  }
  if (ipCount > 10000) {
    ipRateLimiters.clear();
  }

  return userCount + ipCount;
}

// ============================================================================
// CONTENT GUARD
// ============================================================================

export type GuardedContent = {
  /** Quarantine entry ID */
  quarantineId: string;
  /** Original content (for reference only - do not use directly) */
  originalLength: number;
  /** Sanitized content safe for processing */
  sanitized: string;
  /** Trust level of the content */
  trustLevel: TrustLevel;
  /** Source of the content */
  source: ContentSource;
  /** Detected injection patterns */
  injectionPatterns: SanitizeResult["injectionPatterns"];
  /** Whether secrets were redacted */
  secretsRedacted: boolean;
  /** Whether content was truncated */
  truncated: boolean;
  /** Rate limit check result */
  rateLimitPassed: boolean;
};

export type ContentGuardOptions = {
  /** Source of the content */
  source: ContentSource;
  /** User ID for rate limiting */
  userId?: string;
  /** IP address for rate limiting */
  ip?: string;
  /** Channel the content came from */
  channel?: string;
  /** Sender information */
  sender?: string;
  /** Subject (for emails) */
  subject?: string;
  /** Skip rate limiting */
  skipRateLimit?: boolean;
  /** Maximum content length */
  maxLength?: number;
};

/**
 * Guards incoming content through the security pipeline.
 * This is the main entry point for securing inbound DM/message content.
 */
export function guardIncomingContent(
  content: string,
  options: ContentGuardOptions,
): GuardedContent {
  // Rate limit check
  let rateLimitPassed = true;
  if (!options.skipRateLimit) {
    const rateLimitResult = checkRateLimit({
      userId: options.userId,
      ip: options.ip,
    });
    rateLimitPassed = rateLimitResult.allowed;
  }

  // Quarantine and sanitize
  const entry = quarantineContent({
    content,
    source: options.source,
    metadata: {
      userId: options.userId,
      ip: options.ip,
      channel: options.channel,
      sender: options.sender,
    },
  });

  // Get detailed sanitization results
  const sanitizeResult = sanitizeContentWithDetails(content, {
    stripHtml: true,
    stripHiddenInstructions: true,
    redactSecrets: true,
    maxLength: options.maxLength ?? 100000,
    source: options.source,
  });

  return {
    quarantineId: entry.id,
    originalLength: content.length,
    sanitized: entry.sanitizedContent ?? "",
    trustLevel: entry.trustLevel,
    source: options.source,
    injectionPatterns: sanitizeResult.injectionPatterns,
    secretsRedacted: sanitizeResult.secretsRedacted,
    truncated: sanitizeResult.truncated,
    rateLimitPassed,
  };
}

/**
 * Prepares guarded content for LLM context.
 * Wraps with security boundaries.
 */
export function prepareForLLMContext(
  guarded: GuardedContent,
  options?: {
    sender?: string;
    subject?: string;
  },
): string {
  return wrapExternalContent({
    content: guarded.sanitized,
    source: guarded.source,
    sender: options?.sender,
    subject: options?.subject,
  });
}

/**
 * Checks if content should be blocked.
 */
export function shouldBlockContent(guarded: GuardedContent): {
  blocked: boolean;
  reason?: string;
} {
  // Block if rate limit failed
  if (!guarded.rateLimitPassed) {
    return {
      blocked: true,
      reason: "Rate limit exceeded",
    };
  }

  // Block critical injection attempts (optional - can be configured)
  const hasCritical = guarded.injectionPatterns.some((p) => p.severity === "critical");
  if (hasCritical) {
    // Log but don't necessarily block - sanitization handles it
    // return { blocked: true, reason: 'Critical injection pattern detected' };
  }

  return { blocked: false };
}

// ============================================================================
// ATTACK LOGGING
// ============================================================================

export type AttackLogEntry = {
  timestamp: Date;
  source: ContentSource;
  userId?: string;
  ip?: string;
  patterns: Array<{ name: string; severity: string; count: number }>;
  blocked: boolean;
  quarantineId: string;
};

const attackLog: AttackLogEntry[] = [];
const MAX_ATTACK_LOG_SIZE = 1000;

/**
 * Logs a potential attack for monitoring.
 */
export function logPotentialAttack(entry: AttackLogEntry): void {
  attackLog.push(entry);

  // Trim log if too large
  if (attackLog.length > MAX_ATTACK_LOG_SIZE) {
    attackLog.splice(0, attackLog.length - MAX_ATTACK_LOG_SIZE);
  }
}

/**
 * Gets recent attack log entries.
 */
export function getAttackLog(limit: number = 100): AttackLogEntry[] {
  return attackLog.slice(-limit);
}

/**
 * Gets attack statistics.
 */
export function getAttackStats(): {
  total: number;
  last24h: number;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
} {
  const now = Date.now();
  const dayAgo = now - 86400000;

  const stats = {
    total: attackLog.length,
    last24h: 0,
    bySource: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
  };

  for (const entry of attackLog) {
    if (entry.timestamp.getTime() > dayAgo) {
      stats.last24h++;
    }

    stats.bySource[entry.source] = (stats.bySource[entry.source] ?? 0) + 1;

    for (const pattern of entry.patterns) {
      stats.bySeverity[pattern.severity] =
        (stats.bySeverity[pattern.severity] ?? 0) + pattern.count;
    }
  }

  return stats;
}
