import { danger, info, logVerboseConsole, success, warn } from "./globals.js";
import { getLogger } from "./logging/logger.js";
import { createSubsystemLogger } from "./logging/subsystem.js";
import { defaultRuntime, type RuntimeEnv } from "./runtime.js";
import {
  redactLogMessage,
  isProductionMode,
  shouldLogDebug,
  sanitizeError,
} from "./security/integration/logger-middleware.js";

const subsystemPrefixRe = /^([a-z][a-z0-9-]{1,20}):\s+(.*)$/i;

function splitSubsystem(message: string) {
  const match = message.match(subsystemPrefixRe);
  if (!match) return null;
  const [, subsystem, rest] = match;
  return { subsystem, rest };
}

export function logInfo(message: string, runtime: RuntimeEnv = defaultRuntime) {
  // SECURITY: Redact secrets before logging
  const safeMessage = redactLogMessage(message);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safeMessage) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).info(parsed.rest);
    return;
  }
  runtime.log(info(safeMessage));
  getLogger().info(safeMessage);
}

export function logWarn(message: string, runtime: RuntimeEnv = defaultRuntime) {
  // SECURITY: Redact secrets before logging
  const safeMessage = redactLogMessage(message);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safeMessage) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).warn(parsed.rest);
    return;
  }
  runtime.log(warn(safeMessage));
  getLogger().warn(safeMessage);
}

export function logSuccess(message: string, runtime: RuntimeEnv = defaultRuntime) {
  // SECURITY: Redact secrets before logging
  const safeMessage = redactLogMessage(message);
  const parsed = runtime === defaultRuntime ? splitSubsystem(safeMessage) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).info(parsed.rest);
    return;
  }
  runtime.log(success(safeMessage));
  getLogger().info(safeMessage);
}

export function logError(message: string, runtime: RuntimeEnv = defaultRuntime) {
  // SECURITY: Redact secrets and sanitize in production
  let safeMessage = redactLogMessage(message);
  if (isProductionMode()) {
    // In production, don't leak verbose error details
    safeMessage = safeMessage.split("\n")[0] || safeMessage;
  }
  const parsed = runtime === defaultRuntime ? splitSubsystem(safeMessage) : null;
  if (parsed) {
    createSubsystemLogger(parsed.subsystem).error(parsed.rest);
    return;
  }
  runtime.error(danger(safeMessage));
  getLogger().error(safeMessage);
}

export function logDebug(message: string) {
  // SECURITY: Skip debug logs in production unless explicitly enabled
  if (!shouldLogDebug()) {
    return;
  }
  // SECURITY: Redact secrets before logging
  const safeMessage = redactLogMessage(message);
  // Always emit to file logger (level-filtered); console only when verbose.
  getLogger().debug(safeMessage);
  logVerboseConsole(safeMessage);
}
