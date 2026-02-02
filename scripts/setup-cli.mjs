#!/usr/bin/env node
/**
 * CLI Setup Wizard for Moltbot
 * Usage: npm run setup
 */

import readline from "readline";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(process.cwd(), ".moltbot-config.json");
const ENV_PATH = path.join(process.cwd(), ".env");

// Check if already configured
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    if (config.setupLocked) {
      console.log("\n⚠️  Setup is LOCKED. Configuration already exists.");
      console.log("   To reconfigure, unlock via /admin/security or delete .moltbot-config.json\n");
      process.exit(0);
    }
  } catch {
    // Continue with setup
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue) {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let password = "";
    stdin.on("data", function handler(char) {
      char = char.toString();
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(password);
      } else if (char === "\u007F" || char === "\b") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(`${question}: ${"*".repeat(password.length)}`);
        }
      } else if (char === "\u0003") {
        process.exit();
      } else {
        password += char;
        process.stdout.write("*");
      }
    });
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║       MOLTBOT SETUP WIZARD                 ║");
  console.log("╚════════════════════════════════════════════╝\n");

  // Generate and display setup token
  const setupToken = crypto.randomBytes(32).toString("hex");
  console.log("🔑 SETUP TOKEN (save this for /setup UI access):");
  console.log(`   ${setupToken}\n`);

  // Write token to env
  let envContent = "";
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, "utf-8");
    envContent = envContent.replace(/^SETUP_TOKEN=.*$/m, "");
  }
  envContent = `SETUP_TOKEN=${setupToken}\n${envContent}`.trim() + "\n";
  fs.writeFileSync(ENV_PATH, envContent);

  console.log("Answer the following questions to configure Moltbot:\n");

  // 1) Admin email
  const adminEmail = await ask("1) Admin email");
  if (!adminEmail.includes("@")) {
    console.error("❌ Invalid email");
    process.exit(1);
  }

  // 2) Admin password
  const adminPassword = await askPassword("2) Admin password");
  if (adminPassword.length < 8) {
    console.error("❌ Password must be at least 8 characters");
    process.exit(1);
  }

  // 3) HITL mode
  const hitlMode = await ask("3) HITL_MODE (off/selective/full)", "selective");
  if (!["off", "selective", "full"].includes(hitlMode)) {
    console.error("❌ Invalid HITL mode");
    process.exit(1);
  }

  // 4) Lockdown mode
  const lockdownInput = await ask("4) LOCKDOWN_MODE (true/false)", "true");
  const lockdownMode = lockdownInput === "true";

  // 5) LLM Provider
  const llmProvider = await ask("5) LLM_PROVIDER (auto/moonshot/openrouter/local)", "auto");
  if (!["auto", "moonshot", "openrouter", "local"].includes(llmProvider)) {
    console.error("❌ Invalid LLM provider");
    process.exit(1);
  }

  // 6) Moonshot API key
  let moonshotApiKey = "";
  if (llmProvider === "moonshot" || llmProvider === "auto") {
    moonshotApiKey = await askPassword("6) MOONSHOT_API_KEY (or press enter to skip)");
  }

  // 7) OpenRouter API key
  let openrouterApiKey = "";
  if (llmProvider === "openrouter" || llmProvider === "auto") {
    openrouterApiKey = await askPassword("7) OPENROUTER_API_KEY (or press enter to skip)");
  }

  // 8) Local base URL
  let localBaseUrl = "http://localhost:11434/v1";
  if (llmProvider === "local") {
    localBaseUrl = await ask("8) LOCAL_BASE_URL", localBaseUrl);
  }

  // 9) Allowlist domains
  const defaultDomains = "api.moonshot.cn,openrouter.ai,api.openai.com,api.anthropic.com";
  const allowlistInput = await ask("9) Allowlist outbound domains (comma-separated)", defaultDomains);
  const allowlistDomains = allowlistInput.split(",").map((d) => d.trim()).filter(Boolean);

  // 10) Budgets
  const budgetPerRunUsd = parseFloat(await ask("10a) Per-run budget USD", "1")) || 1;
  const budgetDailyUsd = parseFloat(await ask("10b) Daily budget USD", "10")) || 10;
  const budgetMonthlyUsd = parseFloat(await ask("10c) Monthly budget USD", "100")) || 100;

  console.log("\n⏳ Applying configuration...\n");

  // Build config
  const config = {
    adminEmail,
    adminPasswordHash: hashPassword(adminPassword),
    hitlMode,
    lockdownMode,
    llmProvider,
    moonshotApiKey: moonshotApiKey || undefined,
    openrouterApiKey: openrouterApiKey || undefined,
    localBaseUrl,
    allowlistDomains,
    budgetPerRunUsd,
    budgetDailyUsd,
    budgetMonthlyUsd,
    setupLocked: true,
    createdAt: new Date().toISOString(),
  };

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  // Update .env
  let envLines = [];
  if (fs.existsSync(ENV_PATH)) {
    envLines = fs.readFileSync(ENV_PATH, "utf-8").split("\n").filter((line) => {
      return !line.startsWith("HITL_MODE=") &&
        !line.startsWith("LOCKDOWN_MODE=") &&
        !line.startsWith("LLM_PROVIDER=") &&
        !line.startsWith("SETUP_LOCKED=") &&
        !line.startsWith("ALLOWLIST_OUTBOUND_DOMAINS=") &&
        !line.startsWith("TOKEN_BUDGET_PER_RUN_USD=") &&
        !line.startsWith("TOKEN_BUDGET_DAILY_USD=") &&
        !line.startsWith("TOKEN_BUDGET_MONTHLY_USD=") &&
        !line.startsWith("LOCAL_BASE_URL=") &&
        !line.startsWith("MOONSHOT_API_KEY=") &&
        !line.startsWith("OPENROUTER_API_KEY=");
    });
  }

  envLines.push(`HITL_MODE=${hitlMode}`);
  envLines.push(`LOCKDOWN_MODE=${lockdownMode}`);
  envLines.push(`LLM_PROVIDER=${llmProvider}`);
  envLines.push(`SETUP_LOCKED=true`);
  envLines.push(`ALLOWLIST_OUTBOUND_DOMAINS=${allowlistDomains.join(",")}`);
  envLines.push(`TOKEN_BUDGET_PER_RUN_USD=${budgetPerRunUsd}`);
  envLines.push(`TOKEN_BUDGET_DAILY_USD=${budgetDailyUsd}`);
  envLines.push(`TOKEN_BUDGET_MONTHLY_USD=${budgetMonthlyUsd}`);
  envLines.push(`LOCAL_BASE_URL=${localBaseUrl}`);
  if (moonshotApiKey) envLines.push(`MOONSHOT_API_KEY=${moonshotApiKey}`);
  if (openrouterApiKey) envLines.push(`OPENROUTER_API_KEY=${openrouterApiKey}`);

  fs.writeFileSync(ENV_PATH, envLines.filter(Boolean).join("\n") + "\n");

  console.log("✅ Configuration saved to .moltbot-config.json");
  console.log("✅ Environment updated in .env");
  console.log("✅ Setup is now LOCKED\n");
  console.log("🚀 Start the server with: npm start\n");

  rl.close();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
