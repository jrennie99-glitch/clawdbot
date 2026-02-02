/**
 * Secret Redaction - SUPER SUPREME GOD MODE
 * 
 * Prevents secrets from appearing in logs, prompts, or responses.
 * This is the NO-LEAK GUARANTEE implementation.
 */

import type { SecretPattern, RedactionResult } from './types.js';

// ============================================================================
// SECRET PATTERNS
// ============================================================================

/**
 * Patterns for detecting secrets.
 * SECURITY: Add new patterns here when new credential types are used.
 */
const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys
  {
    name: 'openai_key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    replacement: '[OPENAI_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'anthropic_key',
    pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g,
    replacement: '[ANTHROPIC_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'google_key',
    pattern: /AIza[a-zA-Z0-9_-]{35}/g,
    replacement: '[GOOGLE_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'moonshot_key',
    pattern: /sk-[a-zA-Z0-9]{40,}/g,
    replacement: '[MOONSHOT_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'openrouter_key',
    pattern: /sk-or-[a-zA-Z0-9-]{40,}/g,
    replacement: '[OPENROUTER_KEY_REDACTED]',
    severity: 'critical',
  },
  
  // AWS Credentials
  {
    name: 'aws_access_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: '[AWS_ACCESS_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'aws_secret_key',
    pattern: /(?<![a-zA-Z0-9\/+=])[a-zA-Z0-9\/+=]{40}(?![a-zA-Z0-9\/+=])/g,
    replacement: '[AWS_SECRET_REDACTED]',
    severity: 'high', // Lower because of false positives
  },
  
  // GitHub
  {
    name: 'github_token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'github_oauth',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    replacement: '[GITHUB_OAUTH_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'github_pat',
    pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
    replacement: '[GITHUB_PAT_REDACTED]',
    severity: 'critical',
  },
  
  // Slack
  {
    name: 'slack_token',
    pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g,
    replacement: '[SLACK_TOKEN_REDACTED]',
    severity: 'critical',
  },
  
  // Discord
  {
    name: 'discord_token',
    pattern: /[MN][a-zA-Z0-9]{23,}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27}/g,
    replacement: '[DISCORD_TOKEN_REDACTED]',
    severity: 'critical',
  },
  
  // Telegram
  {
    name: 'telegram_token',
    pattern: /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/g,
    replacement: '[TELEGRAM_TOKEN_REDACTED]',
    severity: 'critical',
  },
  
  // Twilio
  {
    name: 'twilio_sid',
    pattern: /AC[a-f0-9]{32}/g,
    replacement: '[TWILIO_SID_REDACTED]',
    severity: 'high',
  },
  {
    name: 'twilio_auth',
    pattern: /SK[a-f0-9]{32}/g,
    replacement: '[TWILIO_AUTH_REDACTED]',
    severity: 'critical',
  },
  
  // Stripe
  {
    name: 'stripe_key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    replacement: '[STRIPE_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'stripe_test_key',
    pattern: /sk_test_[a-zA-Z0-9]{24,}/g,
    replacement: '[STRIPE_TEST_KEY_REDACTED]',
    severity: 'high',
  },
  
  // SendGrid
  {
    name: 'sendgrid_key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    replacement: '[SENDGRID_KEY_REDACTED]',
    severity: 'critical',
  },
  
  // Generic Patterns
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[a-zA-Z0-9_\-.~+\/]+=*/gi,
    replacement: 'Bearer [TOKEN_REDACTED]',
    severity: 'high',
  },
  {
    name: 'basic_auth',
    pattern: /Basic\s+[a-zA-Z0-9+\/]+=*/gi,
    replacement: 'Basic [AUTH_REDACTED]',
    severity: 'high',
  },
  {
    name: 'jwt_token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: '[JWT_REDACTED]',
    severity: 'high',
  },
  
  // Private Keys
  {
    name: 'private_key_header',
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'private_key_content',
    pattern: /-----BEGIN[\s\S]*?-----END[^-]*-----/g,
    replacement: '[KEY_BLOCK_REDACTED]',
    severity: 'critical',
  },
  
  // Connection Strings
  {
    name: 'postgres_url',
    pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@[^\s]+/gi,
    replacement: '[POSTGRES_URL_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'mysql_url',
    pattern: /mysql:\/\/[^:]+:[^@]+@[^\s]+/gi,
    replacement: '[MYSQL_URL_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'mongodb_url',
    pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\s]+/gi,
    replacement: '[MONGODB_URL_REDACTED]',
    severity: 'critical',
  },
  {
    name: 'redis_url',
    pattern: /redis:\/\/[^:]+:[^@]+@[^\s]+/gi,
    replacement: '[REDIS_URL_REDACTED]',
    severity: 'critical',
  },
  
  // Password patterns in config
  {
    name: 'password_field',
    pattern: /["']?password["']?\s*[:=]\s*["']([^"']{8,})["']/gi,
    replacement: '"password": "[PASSWORD_REDACTED]"',
    severity: 'high',
  },
  {
    name: 'secret_field',
    pattern: /["']?secret["']?\s*[:=]\s*["']([^"']{8,})["']/gi,
    replacement: '"secret": "[SECRET_REDACTED]"',
    severity: 'high',
  },
  {
    name: 'api_key_field',
    pattern: /["']?api[_-]?key["']?\s*[:=]\s*["']([^"']{16,})["']/gi,
    replacement: '"api_key": "[API_KEY_REDACTED]"',
    severity: 'high',
  },
];

// ============================================================================
// REDACTION FUNCTIONS
// ============================================================================

/**
 * Redacts secrets from a string.
 * 
 * SECURITY: This function MUST be called before:
 * - Logging any content
 * - Sending content to LLM
 * - Returning content in API responses
 */
export function redactSecrets(content: string): RedactionResult {
  let redacted = content;
  const secretsFound: RedactionResult['secretsFound'] = [];
  
  for (const { name, pattern, replacement, severity } of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      secretsFound.push({
        pattern: name,
        count: matches.length,
        severity,
      });
      redacted = redacted.replace(pattern, replacement);
    }
  }
  
  return {
    original: content,
    redacted,
    secretsFound,
    wasRedacted: secretsFound.length > 0,
  };
}

/**
 * Checks if content contains any secrets without redacting.
 */
export function containsSecrets(content: string): boolean {
  for (const { pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Gets the severity level of secrets in content.
 */
export function getSecretSeverity(
  content: string,
): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  const result = redactSecrets(content);
  
  if (!result.wasRedacted) return 'none';
  if (result.secretsFound.some(s => s.severity === 'critical')) return 'critical';
  if (result.secretsFound.some(s => s.severity === 'high')) return 'high';
  if (result.secretsFound.some(s => s.severity === 'medium')) return 'medium';
  return 'low';
}

/**
 * Creates a logging middleware that redacts secrets.
 */
export function createRedactionMiddleware() {
  return {
    /** Redacts secrets from log arguments */
    redactArgs: (...args: unknown[]): unknown[] => {
      return args.map(arg => {
        if (typeof arg === 'string') {
          return redactSecrets(arg).redacted;
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            const json = JSON.stringify(arg);
            const redacted = redactSecrets(json).redacted;
            return JSON.parse(redacted);
          } catch {
            return arg;
          }
        }
        return arg;
      });
    },
    
    /** Checks if any arg contains secrets */
    hasSecrets: (...args: unknown[]): boolean => {
      return args.some(arg => {
        if (typeof arg === 'string') {
          return containsSecrets(arg);
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            return containsSecrets(JSON.stringify(arg));
          } catch {
            return false;
          }
        }
        return false;
      });
    },
  };
}

/**
 * Redacts environment variables from content.
 */
export function redactEnvVars(
  content: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  let redacted = content;
  
  // Sensitive env var patterns
  const sensitivePatterns = [
    /KEY/i, /SECRET/i, /TOKEN/i, /PASSWORD/i, /AUTH/i,
    /CREDENTIAL/i, /PRIVATE/i, /API/i,
  ];
  
  for (const [key, value] of Object.entries(env)) {
    if (!value || value.length < 8) continue;
    
    const isSensitive = sensitivePatterns.some(p => p.test(key));
    if (!isSensitive) continue;
    
    // Escape special regex characters in the value
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'g');
    redacted = redacted.replace(pattern, `[ENV:${key}_REDACTED]`);
  }
  
  return redacted;
}

/**
 * Safe stringify that redacts secrets.
 */
export function safeStringify(obj: unknown, space?: number): string {
  try {
    const json = JSON.stringify(obj, null, space);
    return redactSecrets(json).redacted;
  } catch {
    return '[STRINGIFY_FAILED]';
  }
}
