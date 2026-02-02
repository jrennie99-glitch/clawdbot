/**
 * Logger Middleware - SUPER SUPREME GOD MODE
 *
 * Middleware for the existing logger to ensure secrets are never logged.
 */

import { redactSecrets, redactEnvVars, createRedactionMiddleware } from "../secret-redaction.js";

// ============================================================================
// REDACTION WRAPPER
// ============================================================================

const middleware = createRedactionMiddleware();

/**
 * Wraps a log function to redact secrets.
 */
export function wrapLogFunction<T extends (...args: unknown[]) => void>(fn: T): T {
  return ((...args: unknown[]) => {
    const redactedArgs = middleware.redactArgs(...args);
    fn(...redactedArgs);
  }) as T;
}

/**
 * Redacts a single message string.
 */
export function redactLogMessage(message: string): string {
  // First redact known secret patterns
  let redacted = redactSecrets(message).redacted;

  // Then redact environment variables
  redacted = redactEnvVars(redacted);

  return redacted;
}

/**
 * Creates a wrapped logger instance.
 */
export function createSecureLogger(logger: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
}): {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
} {
  return {
    info: (msg: string) => logger.info(redactLogMessage(msg)),
    warn: (msg: string) => logger.warn(redactLogMessage(msg)),
    error: (msg: string) => logger.error(redactLogMessage(msg)),
    debug: (msg: string) => logger.debug(redactLogMessage(msg)),
  };
}

// ============================================================================
// PRODUCTION LOG FILTERING
// ============================================================================

/**
 * Checks if we're in production mode.
 */
export function isProductionMode(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Filters debug output in production.
 */
export function shouldLogDebug(): boolean {
  if (isProductionMode()) {
    return process.env.DEBUG_LOGGING === "true";
  }
  return true;
}

/**
 * Filters verbose stack traces in production.
 */
export function sanitizeError(error: Error): string {
  const message = error.message;

  // Redact any secrets in error message
  const redactedMessage = redactLogMessage(message);

  // In production, don't include full stack traces
  if (isProductionMode()) {
    return redactedMessage;
  }

  // In dev, include stack but redact secrets
  const stack = error.stack ?? "";
  return redactLogMessage(stack);
}
