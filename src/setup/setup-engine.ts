/**
 * Setup Engine - Shared logic for CLI and UI setup
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(process.cwd(), ".moltbot-config.json");
const ENV_PATH = path.join(process.cwd(), ".env");

export interface SetupConfig {
  adminEmail: string;
  adminPasswordHash: string;
  hitlMode: "off" | "selective" | "full";
  lockdownMode: boolean;
  llmProvider: "auto" | "moonshot" | "openrouter" | "local";
  moonshotApiKey?: string;
  openrouterApiKey?: string;
  localBaseUrl?: string;
  allowlistDomains: string[];
  budgetPerRunUsd: number;
  budgetDailyUsd: number;
  budgetMonthlyUsd: number;
  setupLocked: boolean;
  setupToken?: string;
  createdAt: string;
}

/**
 * Generates a secure setup token
 */
export function generateSetupToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hashes a password securely
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a hash
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verify;
}

/**
 * Checks if setup is required
 */
export function isSetupRequired(): boolean {
  if (!fs.existsSync(CONFIG_PATH)) return true;
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as SetupConfig;
    return !config.setupLocked;
  } catch {
    return true;
  }
}

/**
 * Validates setup token
 */
export function validateSetupToken(token: string): boolean {
  const envToken = process.env.SETUP_TOKEN;
  if (!envToken) return false;
  return token === envToken;
}

/**
 * Loads current config
 */
export function loadConfig(): SetupConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as SetupConfig;
  } catch {
    return null;
  }
}

/**
 * Validates setup input
 */
export function validateSetupInput(input: Partial<SetupConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.adminEmail || !input.adminEmail.includes("@")) {
    errors.push("Valid admin email required");
  }

  if (!input.adminPasswordHash && !input.adminEmail) {
    errors.push("Admin password required");
  }

  if (input.hitlMode && !["off", "selective", "full"].includes(input.hitlMode)) {
    errors.push("HITL mode must be off, selective, or full");
  }

  if (
    input.llmProvider &&
    !["auto", "moonshot", "openrouter", "local"].includes(input.llmProvider)
  ) {
    errors.push("LLM provider must be auto, moonshot, openrouter, or local");
  }

  if (input.llmProvider === "moonshot" && !input.moonshotApiKey) {
    errors.push("Moonshot API key required when provider is moonshot");
  }

  if (input.llmProvider === "openrouter" && !input.openrouterApiKey) {
    errors.push("OpenRouter API key required when provider is openrouter");
  }

  if (input.budgetPerRunUsd !== undefined && input.budgetPerRunUsd < 0) {
    errors.push("Per-run budget must be positive");
  }

  if (input.budgetDailyUsd !== undefined && input.budgetDailyUsd < 0) {
    errors.push("Daily budget must be positive");
  }

  if (input.budgetMonthlyUsd !== undefined && input.budgetMonthlyUsd < 0) {
    errors.push("Monthly budget must be positive");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Applies setup configuration
 */
export function applySetup(input: {
  adminEmail: string;
  adminPassword: string;
  hitlMode?: "off" | "selective" | "full";
  lockdownMode?: boolean;
  llmProvider?: "auto" | "moonshot" | "openrouter" | "local";
  moonshotApiKey?: string;
  openrouterApiKey?: string;
  localBaseUrl?: string;
  allowlistDomains?: string[];
  budgetPerRunUsd?: number;
  budgetDailyUsd?: number;
  budgetMonthlyUsd?: number;
}): { success: boolean; error?: string } {
  try {
    const config: SetupConfig = {
      adminEmail: input.adminEmail,
      adminPasswordHash: hashPassword(input.adminPassword),
      hitlMode: input.hitlMode ?? "selective",
      lockdownMode: input.lockdownMode ?? true,
      llmProvider: input.llmProvider ?? "auto",
      moonshotApiKey: input.moonshotApiKey,
      openrouterApiKey: input.openrouterApiKey,
      localBaseUrl: input.localBaseUrl ?? "http://localhost:11434/v1",
      allowlistDomains: input.allowlistDomains ?? [
        "api.moonshot.cn",
        "openrouter.ai",
        "api.openai.com",
        "api.anthropic.com",
      ],
      budgetPerRunUsd: input.budgetPerRunUsd ?? 1,
      budgetDailyUsd: input.budgetDailyUsd ?? 10,
      budgetMonthlyUsd: input.budgetMonthlyUsd ?? 100,
      setupLocked: true,
      createdAt: new Date().toISOString(),
    };

    // Validate
    const validation = validateSetupInput(config);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join("; ") };
    }

    // Write config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    // Update .env file
    updateEnvFile(config);

    console.log("[SETUP] Configuration saved successfully");
    console.log("[SETUP] Setup is now LOCKED");

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Updates .env file with config values (no secrets in plain text)
 */
function updateEnvFile(config: SetupConfig): void {
  const envLines: string[] = [];

  // Read existing .env if present
  if (fs.existsSync(ENV_PATH)) {
    const existing = fs.readFileSync(ENV_PATH, "utf-8");
    for (const line of existing.split("\n")) {
      // Keep lines that aren't being updated
      if (
        !line.startsWith("HITL_MODE=") &&
        !line.startsWith("LOCKDOWN_MODE=") &&
        !line.startsWith("LLM_PROVIDER=") &&
        !line.startsWith("SETUP_LOCKED=") &&
        !line.startsWith("ALLOWLIST_OUTBOUND_DOMAINS=") &&
        !line.startsWith("TOKEN_BUDGET_PER_RUN_USD=") &&
        !line.startsWith("TOKEN_BUDGET_DAILY_USD=") &&
        !line.startsWith("TOKEN_BUDGET_MONTHLY_USD=") &&
        !line.startsWith("LOCAL_BASE_URL=")
      ) {
        envLines.push(line);
      }
    }
  }

  // Add config values
  envLines.push(`HITL_MODE=${config.hitlMode}`);
  envLines.push(`LOCKDOWN_MODE=${config.lockdownMode}`);
  envLines.push(`LLM_PROVIDER=${config.llmProvider}`);
  envLines.push(`SETUP_LOCKED=true`);
  envLines.push(`ALLOWLIST_OUTBOUND_DOMAINS=${config.allowlistDomains.join(",")}`);
  envLines.push(`TOKEN_BUDGET_PER_RUN_USD=${config.budgetPerRunUsd}`);
  envLines.push(`TOKEN_BUDGET_DAILY_USD=${config.budgetDailyUsd}`);
  envLines.push(`TOKEN_BUDGET_MONTHLY_USD=${config.budgetMonthlyUsd}`);
  if (config.localBaseUrl) {
    envLines.push(`LOCAL_BASE_URL=${config.localBaseUrl}`);
  }

  // Write .env
  fs.writeFileSync(ENV_PATH, envLines.filter(Boolean).join("\n") + "\n");
}

/**
 * Unlocks setup (admin only)
 */
export function unlockSetup(): boolean {
  if (!fs.existsSync(CONFIG_PATH)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as SetupConfig;
    config.setupLocked = false;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets safe config for display (no secrets)
 */
export function getSafeConfig(): Partial<SetupConfig> | null {
  const config = loadConfig();
  if (!config) return null;

  return {
    adminEmail: config.adminEmail,
    hitlMode: config.hitlMode,
    lockdownMode: config.lockdownMode,
    llmProvider: config.llmProvider,
    localBaseUrl: config.localBaseUrl,
    allowlistDomains: config.allowlistDomains,
    budgetPerRunUsd: config.budgetPerRunUsd,
    budgetDailyUsd: config.budgetDailyUsd,
    budgetMonthlyUsd: config.budgetMonthlyUsd,
    setupLocked: config.setupLocked,
    createdAt: config.createdAt,
    // Mask secrets
    moonshotApiKey: config.moonshotApiKey ? "***configured***" : undefined,
    openrouterApiKey: config.openrouterApiKey ? "***configured***" : undefined,
  };
}
