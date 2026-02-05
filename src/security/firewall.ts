/**
 * Cybersecurity Defense System - Request Firewall (Mini-WAF)
 *
 * Global security middleware for all HTTP/WS requests.
 * Validates: auth, origin, payload size, headers, rate limits
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security").child("firewall");

// ============================================================================
// CONFIGURATION FROM ENV
// ============================================================================

export const FIREWALL_CONFIG = {
  // Request limits
  maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE_BYTES || "1048576", 10), // 1MB default
  maxHeaderSize: parseInt(process.env.MAX_HEADER_SIZE_BYTES || "8192", 10), // 8KB
  maxUrlLength: parseInt(process.env.MAX_URL_LENGTH || "2048", 10),

  // Rate limits
  apiRequestsPerMinute: parseInt(process.env.RATE_LIMIT_API_PER_MINUTE || "60", 10),
  loginAttemptsPerHour: parseInt(process.env.RATE_LIMIT_LOGIN_PER_HOUR || "5", 10),
  wsConnectionsPerIp: parseInt(process.env.RATE_LIMIT_WS_PER_IP || "3", 10),

  // Auto-block settings
  autoBlockDurationMs: parseInt(process.env.AUTO_BLOCK_DURATION_MS || "1800000", 10), // 30 min
  maxFailedAuthAttempts: parseInt(process.env.MAX_FAILED_AUTH_ATTEMPTS || "5", 10),

  // Enabled features
  enabled: process.env.SECURITY_FIREWALL !== "false",
  strictMode: process.env.SECURITY_STRICT_MODE === "true",
};

// ============================================================================
// BLOCKED IP TRACKING
// ============================================================================

interface BlockedIpEntry {
  ip: string;
  blockedAt: number;
  expiresAt: number;
  reason: string;
  failedAttempts: number;
}

const blockedIps = new Map<string, BlockedIpEntry>();
const failedAuthAttempts = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Check if an IP is currently blocked
 */
export function isIpBlocked(ip: string): { blocked: boolean; reason?: string; expiresAt?: number } {
  const entry = blockedIps.get(ip);
  if (!entry) return { blocked: false };

  if (Date.now() > entry.expiresAt) {
    blockedIps.delete(ip);
    return { blocked: false };
  }

  return { blocked: true, reason: entry.reason, expiresAt: entry.expiresAt };
}

/**
 * Block an IP address
 */
export function blockIp(ip: string, reason: string, durationMs?: number): void {
  const duration = durationMs ?? FIREWALL_CONFIG.autoBlockDurationMs;
  const entry: BlockedIpEntry = {
    ip,
    blockedAt: Date.now(),
    expiresAt: Date.now() + duration,
    reason,
    failedAttempts: (blockedIps.get(ip)?.failedAttempts ?? 0) + 1,
  };
  blockedIps.set(ip, entry);

  log.warn(`IP blocked: ${ip} - Reason: ${reason} - Duration: ${duration}ms`);
  logSecurityIncident({
    type: "ip_blocked",
    ip,
    reason,
    durationMs: duration,
  });
}

/**
 * Unblock an IP address
 */
export function unblockIp(ip: string): boolean {
  const existed = blockedIps.delete(ip);
  if (existed) {
    log.info(`IP unblocked: ${ip}`);
  }
  return existed;
}

/**
 * Get all blocked IPs
 */
export function getBlockedIps(): BlockedIpEntry[] {
  const now = Date.now();
  // Clean expired entries
  for (const [ip, entry] of blockedIps) {
    if (now > entry.expiresAt) {
      blockedIps.delete(ip);
    }
  }
  return Array.from(blockedIps.values());
}

/**
 * Record a failed auth attempt
 */
export function recordFailedAuth(ip: string): boolean {
  const now = Date.now();
  const entry = failedAuthAttempts.get(ip);

  if (!entry || now - entry.firstAttempt > 3600000) {
    // Reset after 1 hour
    failedAuthAttempts.set(ip, { count: 1, firstAttempt: now });
    return false;
  }

  entry.count++;

  if (entry.count >= FIREWALL_CONFIG.maxFailedAuthAttempts) {
    blockIp(ip, `Too many failed auth attempts (${entry.count})`);
    failedAuthAttempts.delete(ip);
    return true;
  }

  return false;
}

/**
 * Clear failed auth attempts for an IP (on successful auth)
 */
export function clearFailedAuth(ip: string): void {
  failedAuthAttempts.delete(ip);
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const apiRateLimits = new Map<string, RateLimitBucket>();
const loginRateLimits = new Map<string, RateLimitBucket>();
const wsConnections = new Map<string, number>();

function consumeToken(
  bucket: RateLimitBucket,
  maxTokens: number,
  refillRatePerSecond: number,
): boolean {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRatePerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/**
 * Check API rate limit for an IP
 */
export function checkApiRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  let bucket = apiRateLimits.get(ip);
  if (!bucket) {
    bucket = { tokens: FIREWALL_CONFIG.apiRequestsPerMinute, lastRefill: Date.now() };
    apiRateLimits.set(ip, bucket);
  }

  const refillRate = FIREWALL_CONFIG.apiRequestsPerMinute / 60; // tokens per second
  if (consumeToken(bucket, FIREWALL_CONFIG.apiRequestsPerMinute, refillRate)) {
    return { allowed: true };
  }

  logSecurityIncident({ type: "rate_limit_api", ip });
  return { allowed: false, retryAfterMs: Math.ceil((1 / refillRate) * 1000) };
}

/**
 * Check login rate limit for an IP
 */
export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  let bucket = loginRateLimits.get(ip);
  if (!bucket) {
    bucket = { tokens: FIREWALL_CONFIG.loginAttemptsPerHour, lastRefill: Date.now() };
    loginRateLimits.set(ip, bucket);
  }

  const refillRate = FIREWALL_CONFIG.loginAttemptsPerHour / 3600; // tokens per second
  if (consumeToken(bucket, FIREWALL_CONFIG.loginAttemptsPerHour, refillRate)) {
    return { allowed: true };
  }

  logSecurityIncident({ type: "rate_limit_login", ip });
  return { allowed: false, retryAfterMs: Math.ceil((1 / refillRate) * 1000) };
}

/**
 * Track WebSocket connection for an IP
 */
export function trackWsConnection(ip: string): { allowed: boolean } {
  const current = wsConnections.get(ip) ?? 0;
  if (current >= FIREWALL_CONFIG.wsConnectionsPerIp) {
    logSecurityIncident({ type: "ws_connection_limit", ip, currentCount: current });
    return { allowed: false };
  }
  wsConnections.set(ip, current + 1);
  return { allowed: true };
}

/**
 * Release WebSocket connection for an IP
 */
export function releaseWsConnection(ip: string): void {
  const current = wsConnections.get(ip) ?? 0;
  if (current > 0) {
    wsConnections.set(ip, current - 1);
  }
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

export type FirewallValidationResult = {
  allowed: boolean;
  reason?: string;
  code?: number;
};

/**
 * Validate request headers
 */
export function validateHeaders(
  headers: Record<string, string | string[] | undefined>,
): FirewallValidationResult {
  if (!FIREWALL_CONFIG.enabled) return { allowed: true };

  // Check header size (rough estimate)
  const headerStr = JSON.stringify(headers);
  if (headerStr.length > FIREWALL_CONFIG.maxHeaderSize) {
    return { allowed: false, reason: "Headers too large", code: 431 };
  }

  // Check for suspicious headers
  const suspiciousHeaders = [
    "x-forwarded-host", // Only if not from trusted proxy
    "x-original-url",
    "x-rewrite-url",
  ];

  if (FIREWALL_CONFIG.strictMode) {
    for (const header of suspiciousHeaders) {
      if (headers[header]) {
        log.debug(`Suspicious header detected: ${header}`);
      }
    }
  }

  return { allowed: true };
}

/**
 * Validate request payload size
 */
export function validatePayloadSize(contentLength: number | undefined): FirewallValidationResult {
  if (!FIREWALL_CONFIG.enabled) return { allowed: true };

  if (contentLength && contentLength > FIREWALL_CONFIG.maxPayloadSize) {
    return { allowed: false, reason: "Payload too large", code: 413 };
  }

  return { allowed: true };
}

/**
 * Validate URL length
 */
export function validateUrlLength(url: string): FirewallValidationResult {
  if (!FIREWALL_CONFIG.enabled) return { allowed: true };

  if (url.length > FIREWALL_CONFIG.maxUrlLength) {
    return { allowed: false, reason: "URL too long", code: 414 };
  }

  return { allowed: true };
}

/**
 * Detect potential attacks in request
 */
export function detectAttackPatterns(params: {
  url?: string;
  body?: string;
  headers?: Record<string, string | string[] | undefined>;
}): { detected: boolean; pattern?: string } {
  if (!FIREWALL_CONFIG.enabled) return { detected: false };

  const { url = "", body = "" } = params;

  // SQL injection patterns
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|alter)\b.*\b(from|into|table|database)\b)/i,
    /(--|;|\/\*|\*\/|xp_)/i,
    /('\s*or\s+'|"\s*or\s+")/i,
  ];

  // XSS patterns
  const xssPatterns = [/<script[^>]*>[\s\S]*?<\/script>/i, /javascript:/i, /on\w+\s*=/i];

  // Path traversal
  const pathTraversalPatterns = [/\.\.[\/\\]/, /%2e%2e[\/\\%]/i];

  // Command injection
  const cmdPatterns = [/[;&|`$]|\$\(/];

  const combined = url + body;

  for (const pattern of sqlPatterns) {
    if (pattern.test(combined)) {
      return { detected: true, pattern: "SQL injection attempt" };
    }
  }

  for (const pattern of xssPatterns) {
    if (pattern.test(combined)) {
      return { detected: true, pattern: "XSS attempt" };
    }
  }

  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(combined)) {
      return { detected: true, pattern: "Path traversal attempt" };
    }
  }

  for (const pattern of cmdPatterns) {
    if (pattern.test(combined)) {
      return { detected: true, pattern: "Command injection attempt" };
    }
  }

  return { detected: false };
}

// ============================================================================
// SECURITY INCIDENT LOGGING
// ============================================================================

interface SecurityIncident {
  timestamp: string;
  type: string;
  ip?: string;
  details?: Record<string, unknown>;
}

const securityLog: SecurityIncident[] = [];
const MAX_SECURITY_LOG_SIZE = 1000;

/**
 * Log a security incident
 */
export function logSecurityIncident(
  incident: Omit<SecurityIncident, "timestamp"> & { [key: string]: unknown },
): void {
  const { type, ip, ...details } = incident;
  const entry: SecurityIncident = {
    timestamp: new Date().toISOString(),
    type,
    ip,
    details: Object.keys(details).length > 0 ? details : undefined,
  };

  securityLog.unshift(entry);
  if (securityLog.length > MAX_SECURITY_LOG_SIZE) {
    securityLog.pop();
  }

  log.warn(`Security incident: ${type}`, { ip, ...details });
}

/**
 * Get security incident log
 */
export function getSecurityLog(limit = 100): SecurityIncident[] {
  return securityLog.slice(0, Math.min(limit, MAX_SECURITY_LOG_SIZE));
}

/**
 * Get security statistics
 */
export function getSecurityStats(): {
  blockedIps: number;
  recentIncidents: number;
  rateLimitHits: number;
  activeWsConnections: number;
} {
  const recentIncidents = securityLog.filter(
    (i) => Date.now() - new Date(i.timestamp).getTime() < 3600000,
  ).length;

  const rateLimitHits = securityLog.filter(
    (i) =>
      i.type.startsWith("rate_limit") && Date.now() - new Date(i.timestamp).getTime() < 3600000,
  ).length;

  let activeWsConnections = 0;
  for (const count of wsConnections.values()) {
    activeWsConnections += count;
  }

  return {
    blockedIps: blockedIps.size,
    recentIncidents,
    rateLimitHits,
    activeWsConnections,
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup stale entries to prevent memory leaks
 */
export function cleanupFirewallState(): void {
  const now = Date.now();

  // Clean expired blocked IPs
  for (const [ip, entry] of blockedIps) {
    if (now > entry.expiresAt) {
      blockedIps.delete(ip);
    }
  }

  // Clean old rate limit buckets (inactive for > 1 hour)
  const staleThreshold = now - 3600000;
  for (const [ip, bucket] of apiRateLimits) {
    if (bucket.lastRefill < staleThreshold) {
      apiRateLimits.delete(ip);
    }
  }

  for (const [ip, bucket] of loginRateLimits) {
    if (bucket.lastRefill < staleThreshold) {
      loginRateLimits.delete(ip);
    }
  }

  // Clean old failed auth attempts
  for (const [ip, entry] of failedAuthAttempts) {
    if (now - entry.firstAttempt > 3600000) {
      failedAuthAttempts.delete(ip);
    }
  }
}

// Periodic cleanup (every 5 minutes)
setInterval(cleanupFirewallState, 300000);
