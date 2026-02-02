/**
 * Trust Zones Implementation - SUPER SUPREME GOD MODE
 * 
 * Implements the three-zone security architecture:
 * - Zone A: Untrusted Ingestion
 * - Zone B: Reasoning (LLM)
 * - Zone C: Execution (Tools)
 */

import type {
  TrustZone,
  ContentSource,
  TrustLevel,
  MemoryProvenance,
} from './types.js';
import { createContentHash, nowIso } from './utils.js';
import { sanitizeContent, type SanitizeOptions } from './content-sanitizer.js';
import { redactSecrets } from './secret-redaction.js';

// ============================================================================
// ZONE A: UNTRUSTED INGESTION
// ============================================================================

export type QuarantineEntry = {
  id: string;
  rawContent: string;
  sanitizedContent?: string;
  source: ContentSource;
  trustLevel: TrustLevel;
  contentHash: string;
  quarantinedAt: string;
  metadata?: Record<string, unknown>;
};

const quarantineStore = new Map<string, QuarantineEntry>();

/**
 * Quarantines untrusted content before processing.
 * Content from external sources MUST be quarantined first.
 */
export function quarantineContent(params: {
  content: string;
  source: ContentSource;
  metadata?: Record<string, unknown>;
}): QuarantineEntry {
  const { content, source, metadata } = params;
  
  // Determine trust level based on source
  const trustLevel = resolveTrustLevel(source);
  
  // Generate unique ID and content hash
  const id = `quarantine_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const contentHash = createContentHash(content);
  
  // Sanitize the content
  const sanitizedContent = sanitizeContent(content, {
    stripHtml: true,
    stripHiddenInstructions: true,
    redactSecrets: true,
    maxLength: 100000,
    source,
  });
  
  const entry: QuarantineEntry = {
    id,
    rawContent: content,
    sanitizedContent,
    source,
    trustLevel,
    contentHash,
    quarantinedAt: nowIso(),
    metadata,
  };
  
  quarantineStore.set(id, entry);
  
  return entry;
}

/**
 * Resolves trust level based on content source.
 */
export function resolveTrustLevel(source: ContentSource): TrustLevel {
  switch (source) {
    case 'owner':
    case 'system':
      return 'high';
    case 'paired':
      return 'medium';
    case 'unpaired':
    case 'skill':
      return 'low';
    case 'web':
    case 'document':
    case 'email':
    case 'webhook':
    case 'api':
      return 'untrusted';
    default:
      return 'untrusted';
  }
}

/**
 * Retrieves quarantined content by ID.
 */
export function getQuarantinedContent(id: string): QuarantineEntry | undefined {
  return quarantineStore.get(id);
}

/**
 * Removes expired quarantine entries.
 */
export function cleanupQuarantine(maxAgeMs: number = 3600000): number {
  const now = Date.now();
  let removed = 0;
  
  for (const [id, entry] of quarantineStore) {
    const age = now - new Date(entry.quarantinedAt).getTime();
    if (age > maxAgeMs) {
      quarantineStore.delete(id);
      removed++;
    }
  }
  
  return removed;
}

// ============================================================================
// ZONE B: REASONING (LLM)
// ============================================================================

export type ReasoningInput = {
  /** Sanitized summary (NOT raw content) */
  summary: string;
  /** Explicit user command */
  userCommand?: string;
  /** Tool schemas (secrets redacted) */
  toolSchemas?: unknown[];
  /** System context (no secrets) */
  systemContext?: string;
};

/**
 * Context firewall - prepares content for LLM.
 * NEVER passes raw untrusted content to LLM.
 */
export function prepareForReasoning(params: {
  quarantineId: string;
  userCommand?: string;
  toolSchemas?: unknown[];
  systemContext?: string;
}): ReasoningInput | null {
  const entry = quarantineStore.get(params.quarantineId);
  
  if (!entry) {
    return null;
  }
  
  // Only use sanitized content, never raw
  const summary = entry.sanitizedContent ?? '[Content sanitization failed]';
  
  // Redact any secrets from tool schemas
  const sanitizedSchemas = params.toolSchemas 
    ? JSON.parse(redactSecrets(JSON.stringify(params.toolSchemas)).redacted)
    : undefined;
  
  // Redact secrets from system context
  const sanitizedSystemContext = params.systemContext
    ? redactSecrets(params.systemContext).redacted
    : undefined;
  
  return {
    summary,
    userCommand: params.userCommand,
    toolSchemas: sanitizedSchemas,
    systemContext: sanitizedSystemContext,
  };
}

/**
 * Validates that content is safe for LLM reasoning.
 */
export function validateReasoningInput(input: ReasoningInput): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for potential secret leakage
  const secretCheck = redactSecrets(JSON.stringify(input));
  if (secretCheck.wasRedacted) {
    issues.push('Potential secrets detected in reasoning input');
  }
  
  // Check summary length
  if (input.summary.length > 50000) {
    issues.push('Summary exceeds maximum length');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================================================
// ZONE C: EXECUTION (TOOLS)
// ============================================================================

// Tool execution is handled by the Policy Engine
// See: /src/security/policy-engine.ts

/**
 * Validates that a tool call originates from the reasoning zone.
 * Tool calls should only come from LLM decisions, not directly from untrusted input.
 */
export function validateToolCallOrigin(params: {
  sessionKey?: string;
  sourceZone: TrustZone;
  tool: string;
}): { valid: boolean; reason: string } {
  const { sourceZone, tool } = params;
  
  // Tool calls must originate from the reasoning zone
  if (sourceZone === 'untrusted') {
    return {
      valid: false,
      reason: `Tool '${tool}' call rejected: cannot execute directly from untrusted zone`,
    };
  }
  
  // Execution zone can call other tools (for chaining)
  if (sourceZone === 'execution') {
    return {
      valid: true,
      reason: 'Tool chaining allowed from execution zone',
    };
  }
  
  // Reasoning zone is the primary source
  if (sourceZone === 'reasoning') {
    return {
      valid: true,
      reason: 'Tool call from reasoning zone',
    };
  }
  
  return {
    valid: false,
    reason: `Unknown source zone: ${sourceZone}`,
  };
}

// ============================================================================
// MEMORY PROVENANCE TRACKING
// ============================================================================

const memoryProvenanceStore = new Map<string, MemoryProvenance>();

/**
 * Creates provenance tracking for memory entries.
 */
export function createMemoryProvenance(params: {
  content: string;
  source: ContentSource;
  metadata?: Record<string, unknown>;
  ttlMs?: number;
}): MemoryProvenance {
  const { content, source, metadata, ttlMs } = params;
  
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  
  const provenance: MemoryProvenance = {
    id,
    sourceType: source,
    trustLevel: resolveTrustLevel(source),
    createdAt: now,
    expiresAt: ttlMs ? new Date(now.getTime() + ttlMs) : undefined,
    contentHash: createContentHash(content),
    metadata: {
      ...metadata,
      sanitized: true,
    },
  };
  
  memoryProvenanceStore.set(id, provenance);
  
  return provenance;
}

/**
 * Checks if memory entry is trusted enough for planning/execution.
 */
export function isMemoryTrustedForPlanning(provenanceId: string): boolean {
  const provenance = memoryProvenanceStore.get(provenanceId);
  
  if (!provenance) {
    return false;
  }
  
  // Check expiration
  if (provenance.expiresAt && new Date() > provenance.expiresAt) {
    return false;
  }
  
  // Only high and medium trust levels can influence planning
  return provenance.trustLevel === 'high' || provenance.trustLevel === 'medium';
}

/**
 * Gets provenance for a memory entry.
 */
export function getMemoryProvenance(id: string): MemoryProvenance | undefined {
  return memoryProvenanceStore.get(id);
}

/**
 * Cleans up expired memory provenance entries.
 */
export function cleanupMemoryProvenance(): number {
  const now = new Date();
  let removed = 0;
  
  for (const [id, provenance] of memoryProvenanceStore) {
    if (provenance.expiresAt && now > provenance.expiresAt) {
      memoryProvenanceStore.delete(id);
      removed++;
    }
  }
  
  return removed;
}
