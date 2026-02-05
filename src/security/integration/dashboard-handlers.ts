/**
 * Security Dashboard Gateway Handlers
 *
 * Internal-only endpoints for security monitoring.
 * Shows: blocked IPs, auth failures, rate-limit hits, gateway disconnects
 */

import type { GatewayRequestHandlers } from "../../gateway/server-methods/types.js";
import {
  getBlockedIps,
  getSecurityLog,
  getSecurityStats,
  blockIp,
  unblockIp,
  FIREWALL_CONFIG,
} from "../firewall.js";
import {
  getActiveConnections,
  getGatewayStats,
  GATEWAY_SECURITY_CONFIG,
} from "../gateway-protection.js";
import {
  getLockdownState,
  activateLockdown,
  deactivateLockdown,
  isAdminUser,
  LOCKDOWN_CONFIG,
} from "../lockdown-mode.js";
import { getLLMConfig } from "../../agents/llm-config.js";

export const securityDashboardHandlers: GatewayRequestHandlers = {
  /**
   * Get complete security dashboard data
   */
  "security.dashboard": async ({ respond }) => {
    try {
      const stats = getSecurityStats();
      const gatewayStats = getGatewayStats();
      const lockdown = getLockdownState();
      const llmConfig = getLLMConfig();

      respond(
        true,
        {
          overview: {
            firewallEnabled: FIREWALL_CONFIG.enabled,
            strictMode: FIREWALL_CONFIG.strictMode,
            lockdownActive: lockdown.enabled,
            emergencyMode: LOCKDOWN_CONFIG.emergencyMode,
          },
          stats: {
            blockedIps: stats.blockedIps,
            recentIncidents: stats.recentIncidents,
            rateLimitHits: stats.rateLimitHits,
            activeWsConnections: stats.activeWsConnections,
          },
          gateway: {
            totalConnections: gatewayStats.totalConnections,
            authenticatedConnections: gatewayStats.authenticatedConnections,
            unauthenticatedConnections: gatewayStats.unauthenticatedConnections,
            passwordRequired: GATEWAY_SECURITY_CONFIG.requirePassword,
            maxConnections: GATEWAY_SECURITY_CONFIG.maxConnectionsTotal,
          },
          lockdown: {
            enabled: lockdown.enabled,
            activatedAt: lockdown.activatedAt?.toISOString(),
            activatedBy: lockdown.activatedBy,
            reason: lockdown.reason,
            restrictions: lockdown.restrictions,
          },
          llmSafety: {
            streaming: llmConfig.streaming,
            timeoutMs: llmConfig.timeoutMs,
            maxRetries: llmConfig.maxRetries,
            configuredProviders: llmConfig.providers.filter((p) => p.configured).length,
          },
          config: {
            firewall: {
              maxPayloadSize: FIREWALL_CONFIG.maxPayloadSize,
              apiRequestsPerMinute: FIREWALL_CONFIG.apiRequestsPerMinute,
              loginAttemptsPerHour: FIREWALL_CONFIG.loginAttemptsPerHour,
              wsConnectionsPerIp: FIREWALL_CONFIG.wsConnectionsPerIp,
              autoBlockDurationMs: FIREWALL_CONFIG.autoBlockDurationMs,
            },
            gateway: {
              maxConnectionsTotal: GATEWAY_SECURITY_CONFIG.maxConnectionsTotal,
              connectionTimeoutMs: GATEWAY_SECURITY_CONFIG.connectionTimeoutMs,
            },
          },
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get blocked IPs list
   */
  "security.blocked.list": async ({ respond }) => {
    try {
      const blocked = getBlockedIps();
      respond(
        true,
        {
          blocked: blocked.map((entry) => ({
            ip: entry.ip,
            blockedAt: new Date(entry.blockedAt).toISOString(),
            expiresAt: new Date(entry.expiresAt).toISOString(),
            reason: entry.reason,
            failedAttempts: entry.failedAttempts,
            remainingMs: entry.expiresAt - Date.now(),
          })),
          total: blocked.length,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Manually block an IP
   */
  "security.blocked.add": async ({ params, respond }) => {
    try {
      const ip = params.ip as string;
      const reason = (params.reason as string) || "Manual block via dashboard";
      const durationMs = params.durationMs as number | undefined;

      if (!ip || typeof ip !== "string") {
        respond(false, undefined, { code: "INVALID_PARAMS", message: "IP address required" });
        return;
      }

      blockIp(ip, reason, durationMs);
      respond(true, { success: true, ip, reason }, undefined);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Unblock an IP
   */
  "security.blocked.remove": async ({ params, respond }) => {
    try {
      const ip = params.ip as string;

      if (!ip || typeof ip !== "string") {
        respond(false, undefined, { code: "INVALID_PARAMS", message: "IP address required" });
        return;
      }

      const removed = unblockIp(ip);
      respond(true, { success: removed, ip }, undefined);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get security incident log
   */
  "security.incidents.list": async ({ params, respond }) => {
    try {
      const limit = Math.min((params.limit as number) || 100, 500);
      const incidents = getSecurityLog(limit);

      respond(
        true,
        {
          incidents,
          total: incidents.length,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get gateway connections
   */
  "security.gateway.connections": async ({ respond }) => {
    try {
      const connections = getActiveConnections();
      const stats = getGatewayStats();

      respond(
        true,
        {
          connections: connections.map((conn) => ({
            id: conn.id,
            ip: conn.ip,
            connectedAt: new Date(conn.connectedAt).toISOString(),
            authenticated: conn.authenticated,
            sessionId: conn.sessionId,
            userId: conn.userId,
            durationMs: Date.now() - conn.connectedAt,
          })),
          stats,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Toggle lockdown mode
   */
  "security.lockdown.toggle": async ({ params, respond }) => {
    try {
      const enable = params.enable as boolean;
      const reason = params.reason as string | undefined;

      if (enable) {
        activateLockdown({
          reason: reason || "Manual activation via dashboard",
          activatedBy: "dashboard",
          restrictions: {
            adminOnly: (params.adminOnly as boolean) ?? true,
            chatDisabled: (params.chatDisabled as boolean) ?? true,
            gatewayRestricted: (params.gatewayRestricted as boolean) ?? false,
            toolsDisabled: (params.toolsDisabled as boolean) ?? true,
          },
        });
      } else {
        deactivateLockdown({ deactivatedBy: "dashboard" });
      }

      const state = getLockdownState();
      respond(true, { lockdown: state }, undefined);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Get lockdown status
   */
  "security.lockdown.status": async ({ respond }) => {
    try {
      const state = getLockdownState();
      respond(
        true,
        {
          enabled: state.enabled,
          activatedAt: state.activatedAt?.toISOString(),
          activatedBy: state.activatedBy,
          reason: state.reason,
          restrictions: state.restrictions,
          adminEmail: LOCKDOWN_CONFIG.adminEmail ? "configured" : "not set",
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },

  /**
   * Check if user is admin
   */
  "security.admin.check": async ({ params, respond }) => {
    try {
      const email = params.email as string;
      const isAdmin = isAdminUser(email);
      respond(true, { isAdmin, email: email || "not provided" }, undefined);
    } catch (err) {
      respond(false, undefined, { code: "SECURITY_ERROR", message: String(err) });
    }
  },
};
