/**
 * Gateway Protection Module
 *
 * Enforces authentication and security on WebSocket connections.
 * - Requires GATEWAY_PASSWORD + valid session token
 * - Rejects unauthorized connections immediately
 * - Logs all auth failures
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  isIpBlocked,
  blockIp,
  recordFailedAuth,
  clearFailedAuth,
  trackWsConnection,
  releaseWsConnection,
  checkApiRateLimit,
  logSecurityIncident,
} from "./firewall.js";

const log = createSubsystemLogger("security").child("gateway");

// ============================================================================
// CONFIGURATION
// ============================================================================

export const GATEWAY_SECURITY_CONFIG = {
  // Password required in addition to token
  requirePassword: process.env.GATEWAY_PASSWORD_REQUIRED === "true",
  gatewayPassword: process.env.GATEWAY_PASSWORD?.trim() || undefined,

  // Session validation
  requireSessionToken: process.env.GATEWAY_REQUIRE_SESSION !== "false",
  sessionTokenHeader: process.env.GATEWAY_SESSION_HEADER || "x-gateway-session",

  // Connection limits
  maxConnectionsTotal: parseInt(process.env.GATEWAY_MAX_CONNECTIONS || "1000", 10),
  connectionTimeoutMs: parseInt(process.env.GATEWAY_CONNECTION_TIMEOUT_MS || "30000", 10),

  // Auth failure handling
  closeOnAuthFailure: process.env.GATEWAY_CLOSE_ON_AUTH_FAILURE !== "false",
  authFailureDelayMs: parseInt(process.env.GATEWAY_AUTH_FAILURE_DELAY_MS || "1000", 10),
};

// ============================================================================
// CONNECTION TRACKING
// ============================================================================

interface GatewayConnection {
  id: string;
  ip: string;
  connectedAt: number;
  authenticated: boolean;
  sessionId?: string;
  userId?: string;
}

const activeConnections = new Map<string, GatewayConnection>();
let connectionCounter = 0;

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
  return `conn_${Date.now()}_${++connectionCounter}`;
}

/**
 * Track a new gateway connection
 */
export function trackGatewayConnection(ip: string): {
  allowed: boolean;
  connectionId?: string;
  reason?: string;
} {
  // Check if IP is blocked
  const blockStatus = isIpBlocked(ip);
  if (blockStatus.blocked) {
    logSecurityIncident({
      type: "gateway_blocked_ip_attempt",
      ip,
      reason: blockStatus.reason,
    });
    return { allowed: false, reason: `IP blocked: ${blockStatus.reason}` };
  }

  // Check rate limit
  const rateLimit = checkApiRateLimit(ip);
  if (!rateLimit.allowed) {
    return { allowed: false, reason: "Rate limit exceeded" };
  }

  // Check WS connection limit for this IP
  const wsLimit = trackWsConnection(ip);
  if (!wsLimit.allowed) {
    return { allowed: false, reason: "Too many connections from this IP" };
  }

  // Check total connection limit
  if (activeConnections.size >= GATEWAY_SECURITY_CONFIG.maxConnectionsTotal) {
    releaseWsConnection(ip);
    logSecurityIncident({
      type: "gateway_max_connections",
      ip,
      currentConnections: activeConnections.size,
    });
    return { allowed: false, reason: "Server at maximum connections" };
  }

  const connectionId = generateConnectionId();
  activeConnections.set(connectionId, {
    id: connectionId,
    ip,
    connectedAt: Date.now(),
    authenticated: false,
  });

  log.debug(`Gateway connection opened: ${connectionId} from ${ip}`);

  return { allowed: true, connectionId };
}

/**
 * Remove a gateway connection
 */
export function removeGatewayConnection(connectionId: string): void {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    releaseWsConnection(conn.ip);
    activeConnections.delete(connectionId);
    log.debug(`Gateway connection closed: ${connectionId}`);
  }
}

/**
 * Mark a connection as authenticated
 */
export function authenticateGatewayConnection(
  connectionId: string,
  sessionId?: string,
  userId?: string,
): void {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    conn.authenticated = true;
    conn.sessionId = sessionId;
    conn.userId = userId;
    clearFailedAuth(conn.ip);
    log.debug(`Gateway connection authenticated: ${connectionId}`);
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export type GatewayAuthParams = {
  token?: string;
  password?: string;
  sessionToken?: string;
  ip: string;
  connectionId: string;
};

export type GatewayAuthResult = {
  success: boolean;
  reason?: string;
  shouldBlock?: boolean;
};

/**
 * Authenticate a gateway connection
 */
export function authenticateGateway(
  params: GatewayAuthParams,
  expectedToken: string,
): GatewayAuthResult {
  const { token, password, ip, connectionId } = params;

  // Check if password is required and provided
  if (GATEWAY_SECURITY_CONFIG.requirePassword) {
    if (!GATEWAY_SECURITY_CONFIG.gatewayPassword) {
      log.error("GATEWAY_PASSWORD_REQUIRED but no GATEWAY_PASSWORD set");
      return { success: false, reason: "Server misconfiguration" };
    }

    if (!password) {
      logAuthFailure(ip, connectionId, "password_missing");
      return { success: false, reason: "Password required" };
    }

    if (password !== GATEWAY_SECURITY_CONFIG.gatewayPassword) {
      logAuthFailure(ip, connectionId, "password_mismatch");
      const shouldBlock = recordFailedAuth(ip);
      return { success: false, reason: "Invalid password", shouldBlock };
    }
  }

  // Validate token
  if (!token) {
    logAuthFailure(ip, connectionId, "token_missing");
    return { success: false, reason: "Token required" };
  }

  // Timing-safe comparison
  if (!safeCompare(token, expectedToken)) {
    logAuthFailure(ip, connectionId, "token_mismatch");
    const shouldBlock = recordFailedAuth(ip);
    return { success: false, reason: "Invalid token", shouldBlock };
  }

  // Authentication successful
  authenticateGatewayConnection(connectionId);
  return { success: true };
}

/**
 * Timing-safe string comparison
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Log an auth failure
 */
function logAuthFailure(ip: string, connectionId: string, reason: string): void {
  logSecurityIncident({
    type: "gateway_auth_failure",
    ip,
    connectionId,
    reason,
  });
  log.warn(`Gateway auth failure: ${reason} from ${ip} (${connectionId})`);
}

// ============================================================================
// CONNECTION INFO
// ============================================================================

/**
 * Get all active gateway connections
 */
export function getActiveConnections(): GatewayConnection[] {
  return Array.from(activeConnections.values());
}

/**
 * Get gateway connection stats
 */
export function getGatewayStats(): {
  totalConnections: number;
  authenticatedConnections: number;
  unauthenticatedConnections: number;
  connectionsByIp: Record<string, number>;
} {
  const connectionsByIp: Record<string, number> = {};
  let authenticated = 0;
  let unauthenticated = 0;

  for (const conn of activeConnections.values()) {
    if (conn.authenticated) {
      authenticated++;
    } else {
      unauthenticated++;
    }
    connectionsByIp[conn.ip] = (connectionsByIp[conn.ip] || 0) + 1;
  }

  return {
    totalConnections: activeConnections.size,
    authenticatedConnections: authenticated,
    unauthenticatedConnections: unauthenticated,
    connectionsByIp,
  };
}

/**
 * Force disconnect all unauthenticated connections older than timeout
 */
export function cleanupStaleConnections(): string[] {
  const now = Date.now();
  const stale: string[] = [];

  for (const [id, conn] of activeConnections) {
    if (
      !conn.authenticated &&
      now - conn.connectedAt > GATEWAY_SECURITY_CONFIG.connectionTimeoutMs
    ) {
      stale.push(id);
    }
  }

  for (const id of stale) {
    logSecurityIncident({
      type: "gateway_stale_connection_cleanup",
      connectionId: id,
    });
    removeGatewayConnection(id);
  }

  return stale;
}

// Periodic cleanup of stale connections
setInterval(cleanupStaleConnections, 60000);
