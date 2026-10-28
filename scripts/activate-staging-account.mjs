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
import { pathToFileURL } from "node:url";
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
 * @param {(msg: string) => void} onError
 */
function failActivationOutcome(outcome, onError) {
  if (outcome === "not_found") {
    onError("Staging account activation failed: account not found or not waitlisted.");
  } else if (outcome === "ambiguous") {
    onError("Staging account activation failed: multiple accounts matched.");
  } else {
    onError("Staging account activation failed: could not verify activation result.");
  }
}

/**
 * @param {{
 *   email: string;
 *   config: string;
 *   env?: NodeJS.ProcessEnv;
 *   spawnSyncFn?: typeof spawnSync;
 *   resolvePath?: (path: string) => string;
 *   now?: () => Date;
 *   maskD1DatabaseIdFn?: typeof maskD1DatabaseId;
 *   maskActivationEmailForLogsFn?: typeof maskActivationEmailForLogs;
 *   onLog?: (msg: string) => void;
 *   onError?: (msg: string) => void;
 * }} options
 * @returns {number}
 */
export function runActivation(options) {
  const {
    email,
    config,
    env = process.env,
    spawnSyncFn = spawnSync,
    resolvePath = resolve,
    now = () => new Date(),
    maskD1DatabaseIdFn = maskD1DatabaseId,
    maskActivationEmailForLogsFn = maskActivationEmailForLogs,
    onLog = (msg) => console.log(msg),
    onError = (msg) => console.error(msg),
  } = options;

  const validated = validateActivationEmail(email);
  if (!validated.ok) {
    onError(`Activation email rejected: ${validated.reason}`);
    return 1;
  }

  const configPath = resolvePath(config);
  const expectedDatabaseId = env.WE_MET_D1_DATABASE_ID_NONPROD ?? "";
  const guard = assertWranglerConfigTargetsNonprodD1(configPath, expectedDatabaseId);
  if (!guard.ok) {
    onError(`D1 database guard failed: ${guard.reason}`);
    return 1;
  }

  maskD1DatabaseIdFn(env.WE_MET_D1_DATABASE_ID_NONPROD ?? "");
  maskActivationEmailForLogsFn(validated.normalized);

  const command = buildActivationUpdateCommand(
    validated.normalized,
    now().toISOString(),
  );
  const wranglerArgv = buildWranglerD1ExecuteArgv(config, command);

  const result = spawnSyncFn("npx", wranglerArgv, WRANGLER_D1_EXECUTE_SPAWN_OPTIONS);

  if (result.status !== 0) {
    onError("Staging account activation failed: database command error.");
    return result.status ?? 1;
  }

  const changes = parseWranglerD1ExecuteRowChanges(result.stdout ?? "");
  const outcome = resolveActivationRowOutcome(changes);
  if (outcome === "success") {
    onLog("Staging account activation succeeded.");
    return 0;
  }
  failActivationOutcome(outcome, onError);
  return 1;
}

function main() {
  const { email, config } = parseArgs(process.argv.slice(2));
  if (!email || !config) {
    usage();
  }
  process.exit(runActivation({ email, config }));
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}
