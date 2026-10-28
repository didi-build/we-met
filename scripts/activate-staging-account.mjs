#!/usr/bin/env node
/**
 * Activate a waitlisted staging account in we-met-db-nonprod (GitHub Actions only).
 *
 * Usage:
 *   node scripts/activate-staging-account.mjs --email <email> --config wrangler.staging.ci.jsonc
 *
 * Requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and WE_MET_D1_DATABASE_ID_NONPROD.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertWranglerConfigTargetsNonprodD1,
  buildActivationUpdateCommand,
  buildWranglerD1ExecuteArgv,
  maskActivationEmailForLogs,
  maskD1DatabaseId,
  parseWranglerD1ExecuteRowChanges,
  resolveActivationRowOutcome,
  validateActivationEmail,
  WRANGLER_D1_EXECUTE_SPAWN_OPTIONS,
} from "./lib/activate-staging-account.mjs";

function usage() {
  console.error(
    "Usage: activate-staging-account.mjs --email <email> --config <wrangler.jsonc>",
  );
  process.exit(1);
}

function parseArgs(argv) {
  /** @type {{ email?: string; config?: string }} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") {
      out.email = argv[++i];
    } else if (arg === "--config") {
      out.config = argv[++i];
    } else if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else {
      console.error(`Unexpected argument: ${arg}`);
      process.exit(1);
    }
  }
  return out;
}

/**
 * @param {'not_found' | 'ambiguous' | 'unparseable'} outcome
 */
function failActivationOutcome(outcome) {
  if (outcome === "not_found") {
    console.error(
      "Staging account activation failed: account not found or not waitlisted.",
    );
  } else if (outcome === "ambiguous") {
    console.error("Staging account activation failed: multiple accounts matched.");
  } else {
    console.error(
      "Staging account activation failed: could not verify activation result.",
    );
  }
  process.exit(1);
}

function main() {
  const { email, config } = parseArgs(process.argv.slice(2));
  if (!email || !config) {
    usage();
  }

  const validated = validateActivationEmail(email);
  if (!validated.ok) {
    console.error(`Activation email rejected: ${validated.reason}`);
    process.exit(1);
  }

  const configPath = resolve(config);
  const guard = assertWranglerConfigTargetsNonprodD1(configPath);
  if (!guard.ok) {
    console.error(`D1 database guard failed: ${guard.reason}`);
    process.exit(1);
  }

  maskD1DatabaseId(process.env.WE_MET_D1_DATABASE_ID_NONPROD ?? "");
  maskActivationEmailForLogs(validated.normalized);

  const updatedAt = new Date().toISOString();
  const command = buildActivationUpdateCommand(validated.normalized, updatedAt);
  const wranglerArgv = buildWranglerD1ExecuteArgv(config, command);

  const result = spawnSync("npx", wranglerArgv, WRANGLER_D1_EXECUTE_SPAWN_OPTIONS);

  if (result.status !== 0) {
    console.error("Staging account activation failed: database command error.");
    process.exit(result.status ?? 1);
  }

  const changes = parseWranglerD1ExecuteRowChanges(result.stdout ?? "");
  const outcome = resolveActivationRowOutcome(changes);
  if (outcome === "success") {
    console.log("Staging account activation succeeded.");
    return;
  }
  failActivationOutcome(outcome);
}

main();
