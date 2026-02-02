/**
 * Security Utilities - SUPER SUPREME GOD MODE
 * 
 * Common utility functions for security infrastructure.
 */

import { createHash } from 'node:crypto';

/**
 * Creates a SHA-256 hash of content.
 */
export function createContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Returns current ISO timestamp.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Generates a secure random ID.
 */
export function generateSecureId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const hash = createHash('sha256')
    .update(`${timestamp}${random}${Math.random()}`)
    .digest('hex')
    .slice(0, 8);
  return `${prefix}_${timestamp}_${hash}`;
}

/**
 * Checks if a string looks like an IP address.
 */
export function isIpAddress(value: string): boolean {
  // IPv4
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  
  return ipv4Pattern.test(value) || ipv6Pattern.test(value);
}

/**
 * Checks if an IP is private/internal.
 */
export function isPrivateIp(ip: string): boolean {
  // Private IPv4 ranges
  const privateRanges = [
    /^127\./,                  // Loopback
    /^10\./,                   // Class A private
    /^172\.(1[6-9]|2\d|3[01])\./,  // Class B private
    /^192\.168\./,             // Class C private
    /^169\.254\./,             // Link-local
    /^0\./,                    // Current network
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // Carrier-grade NAT
    /^::1$/,                   // IPv6 loopback
    /^fc[0-9a-f]{2}:/i,        // IPv6 unique local
    /^fd[0-9a-f]{2}:/i,        // IPv6 unique local
    /^fe80:/i,                 // IPv6 link-local
  ];
  
  return privateRanges.some(pattern => pattern.test(ip));
}

/**
 * Checks if a hostname is blocked.
 */
export function isBlockedHostname(hostname: string): boolean {
  const blocked = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'metadata.google.internal',
    'metadata.google',
    '169.254.169.254',
  ];
  
  const normalized = hostname.toLowerCase().trim();
  return blocked.includes(normalized) || normalized.endsWith('.local');
}

/**
 * Safe JSON parse with fallback.
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Truncates a string to a maximum length.
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Masks a sensitive value for display.
 */
export function maskSensitive(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  return `${start}${'*'.repeat(Math.min(20, value.length - visibleChars * 2))}${end}`;
}

/**
 * Validates that a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Rate limiter using token bucket algorithm.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  consume(count = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
  
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}
