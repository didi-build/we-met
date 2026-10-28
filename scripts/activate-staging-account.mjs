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
  maskD1DatabaseId,
  validateActivationEmail,
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

  const updatedAt = new Date().toISOString();
  const command = buildActivationUpdateCommand(validated.normalized, updatedAt);

  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "WE_MET_DB",
      "--remote",
      "-c",
      config,
      "--command",
      command,
      "--json",
    ],
    { encoding: "utf8", shell: true },
  );

  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    console.error("wrangler d1 execute failed for staging account activation");
    process.exit(result.status ?? 1);
  }

  let rowsWritten = null;
  try {
    const parsed = JSON.parse(result.stdout);
    const meta = parsed?.[0]?.meta;
    if (meta && typeof meta.changes === "number") {
      rowsWritten = meta.changes;
    }
  } catch {
    // ignore parse errors; success still means wrangler exited 0
  }

  if (rowsWritten === 0) {
    console.error(
      "Activation UPDATE matched no rows (unknown email or account not waitlisted).",
    );
    process.exit(1);
  }

  console.log(
    `Staging account activation succeeded (${rowsWritten ?? "unknown"} row(s) changed).`,
  );
}

main();
