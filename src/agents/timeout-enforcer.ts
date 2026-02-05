/**
 * Timeout Enforcement for LLM Requests
 * 
 * CRITICAL: Prevents hanging on cheap models by enforcing:
 * - Connection timeout (5s)
 * - Total request timeout (12s)
 * - Fail-fast on timeout
 * - AbortController integration
 */

import { DEFAULT_CONNECTION_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS } from "./defaults.js";
import { FailoverError } from "./failover-error.js";

export type TimeoutEnforcerOptions = {
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  providerName?: string;
  modelId?: string;
};

/**
 * Wraps a promise with hard timeout enforcement.
 * If timeout is exceeded, the promise is aborted and a FailoverError is thrown.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutEnforcerOptions = {},
): Promise<T> {
  const {
    connectionTimeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS,
    requestTimeoutMs = DEFAULT_LLM_TIMEOUT_MS,
    providerName,
    modelId,
  } = options;

  const timeoutMs = Math.max(requestTimeoutMs, connectionTimeoutMs);
  
  return new Promise<T>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      
      const error = new FailoverError(
        `Request timeout after ${timeoutMs}ms${providerName ? ` (${providerName}${modelId ? `/${modelId}` : ""})` : ""}`,
        {
          reason: "timeout",
          provider: providerName,
          model: modelId,
          status: 408,
        },
      );
      reject(error);
    }, timeoutMs);

    // Execute the promise
    promise
      .then((result) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((err) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
      });
  });
}

/**
 * Creates an AbortController with hard timeout enforcement.
 * Returns controller that will auto-abort after timeout.
 */
export function createAbortControllerWithTimeout(
  timeoutMs: number = DEFAULT_LLM_TIMEOUT_MS,
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new Error(`Request timeout after ${timeoutMs}ms`));
    }
  }, timeoutMs);

  const cleanup = () => {
    clearTimeout(timeoutId);
  };

  return { controller, cleanup };
}

/**
 * Wraps a fetch call with connection and request timeouts.
 * CRITICAL: Prevents hanging on slow connections or stuck requests.
 */
export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  options: TimeoutEnforcerOptions = {},
): Promise<Response> {
  const {
    connectionTimeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS,
    requestTimeoutMs = DEFAULT_LLM_TIMEOUT_MS,
    providerName,
    modelId,
  } = options;

  // Create abort controller for connection timeout
  const connectionController = new AbortController();
  const connectionTimeoutId = setTimeout(() => {
    connectionController.abort(
      new Error(`Connection timeout after ${connectionTimeoutMs}ms`),
    );
  }, connectionTimeoutMs);

  try {
    // First, establish connection with connection timeout
    const fetchPromise = fetch(url, {
      ...init,
      signal: connectionController.signal,
    });

    // Then apply total request timeout
    const response = await withTimeout(fetchPromise, {
      requestTimeoutMs,
      providerName,
      modelId,
    });

    clearTimeout(connectionTimeoutId);
    return response;
  } catch (err) {
    clearTimeout(connectionTimeoutId);
    throw err;
  }
}
