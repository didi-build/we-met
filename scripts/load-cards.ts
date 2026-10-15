#!/usr/bin/env node
/**
 * Load cards from a local gitignored JSON file into D1 via wrangler d1 execute.
 *
 * Usage:
 *   npx tsx scripts/load-cards.ts [--file data/cards.local.json]
 *   npx tsx scripts/load-cards.ts --remote [--file path]
 *   npx tsx scripts/load-cards.ts --remote [--account-id <uuid>] [--file path]
 *   npx tsx scripts/load-cards.ts --validate-only [--file path]
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execPath } from "node:process";
import { buildWranglerArgs } from "./lib/build-wrangler-args.ts";
import {
  assertAccountsExistForLoad,
  buildCardsLoadSql,
  escapeSqlStringLiteral,
  newAccountIdsForLoad,
  newCardIdsForLoad,
} from "../src/card-data/load-sql.ts";
import {
  parseCardsLoadFile,
  validateNonProdEmailSinkDestinations,
} from "../src/card-data/load-file.ts";
import { registerBuiltInLeadSinkKinds } from "../src/card-data/register-lead-sink-kinds.ts";

const D1_CI_CONFIG_REL = "wrangler.d1-nonprod.ci.jsonc";
const DEFAULT_FILE = "data/cards.local.json";

const args = process.argv.slice(2);
let mode: "local" | "remote" = "local";
let filePath = DEFAULT_FILE;
let validateOnly = false;
let accountIdOverride: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--local") {
    mode = "local";
  } else if (arg === "--remote") {
    mode = "remote";
  } else if (arg === "--validate-only") {
    validateOnly = true;
  } else if (arg === "--production") {
    console.error(
      "cards:load no longer supports --production. Publish cards through the app.",
    );
    process.exit(1);
  } else if (arg === "--account-id") {
    accountIdOverride = args[++i]?.trim();
    if (!accountIdOverride) {
      console.error("--account-id requires a value");
      process.exit(1);
    }
  } else if (arg === "--file") {
    filePath = args[++i] ?? "";
    if (!filePath) {
      console.error("--file requires a path");
      process.exit(1);
    }
  } else if (arg.startsWith("-")) {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  } else {
    console.error(`Unexpected argument: ${arg}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  registerBuiltInLeadSinkKinds();
  let raw: string;
  try {
    raw = readFileSync(resolve(filePath), "utf8");
  } catch (error) {
    console.error(`Failed to read load file: ${filePath}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  let loadFile;
  try {
    loadFile = parseCardsLoadFile(JSON.parse(raw));
  } catch (error) {
    console.error("Invalid load file:");
    console.error(error);
    process.exitCode = 1;
    return;
  }

  if (validateOnly) {
    console.log(
      `OK: ${loadFile.cards.length} cards, ${loadFile.hostnames.length} hostnames`,
    );
    return;
  }

  if (mode === "remote") {
    if (!process.env.WE_MET_D1_DATABASE_ID_NONPROD?.trim()) {
      console.error(
        "WE_MET_D1_DATABASE_ID_NONPROD is required for non-prod remote load.",
      );
      process.exitCode = 1;
      return;
    }
    try {
      validateNonProdEmailSinkDestinations(
        loadFile,
        process.env.WE_MET_TEST_MAIL_TO ?? "",
      );
    } catch (error) {
      console.error(String(error));
      process.exitCode = 1;
      return;
    }
  }

  if (accountIdOverride) {
    for (const card of loadFile.cards) {
      card.accountId = accountIdOverride;
    }
  }

  const explicitAccountIds = loadFile.cards
    .map((card) => card.accountId)
    .filter((id): id is string => Boolean(id));

  const sqlRel = `load-${process.pid}.sql`;
  const generatedConfigs: string[] = [];
  let configRel: string | null = null;

  try {
    const updatedAt = new Date().toISOString();
    const newCardIds = newCardIdsForLoad(loadFile);
    const accountIds = newAccountIdsForLoad(loadFile);

    if (mode === "remote") {
      configRel = D1_CI_CONFIG_REL;
      generatedConfigs.push(configRel);
      const prep = spawnSync(
        "node",
        [
          "scripts/prepare-wrangler-config.mjs",
          "--target",
          "d1-migrate-nonprod",
          "--output",
          configRel,
        ],
        { encoding: "utf8" },
      );
      if (prep.status !== 0) {
        if (prep.stderr) process.stderr.write(prep.stderr);
        process.exitCode = prep.status ?? 1;
        return;
      }
    }

    if (explicitAccountIds.length > 0) {
      if (mode === "local") {
        const { getPlatformProxy } = await import("wrangler");
        const proxy = await getPlatformProxy({
          configPath: resolve("wrangler.jsonc"),
          persist: true,
        });
        try {
          const db = proxy.env.WE_MET_DB as D1Database;
          if (!db) {
            throw new Error("WE_MET_DB is not configured");
          }
          await assertAccountsExistForLoad(db, explicitAccountIds);
        } finally {
          await proxy.dispose?.();
        }
      } else if (configRel) {
        assertAccountsExistForRemoteLoad(configRel, explicitAccountIds);
      }
    }

    const sql = buildCardsLoadSql(loadFile, { updatedAt, newCardIds, accountIds });
    writeFileSync(sqlRel, sql, "utf8");

    if (
      process.env.NODE_ENV === "test" &&
      process.env.WE_MET_LOAD_CARDS_TEST_FAIL_AFTER_CONFIG === "1"
    ) {
      throw new Error("WE_MET_LOAD_CARDS_TEST_FAIL_AFTER_CONFIG");
    }

    const execute = spawnSync(
      execPath,
      buildWranglerArgs({
        kind: "execute-file",
        configRel,
        remote: mode === "remote",
        sqlRel,
      }),
      { stdio: "inherit" },
    );
    if (execute.status !== 0) {
      process.exitCode = execute.status ?? 1;
      return;
    }

    for (const card of loadFile.cards) {
      console.log(`Loaded card: ${card.slug}`);
    }
    for (const mapping of loadFile.hostnames) {
      console.log(`Mapped hostname: ${mapping.hostname} → ${mapping.slug}`);
    }

    if (mode === "remote") {
      const readBack = spawnSync(
        execPath,
        buildWranglerArgs({ kind: "read-back", configRel }),
        { encoding: "utf8" },
      );
      if (readBack.stdout) process.stdout.write(readBack.stdout);
      if (readBack.stderr) process.stderr.write(readBack.stderr);
      if (readBack.status !== 0) {
        process.exitCode = readBack.status ?? 1;
      }
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const path of generatedConfigs) {
      try {
        rmSync(resolve(path), { force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    try {
      rmSync(resolve(sqlRel), { force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

function assertAccountsExistForRemoteLoad(
  configRel: string,
  accountIds: string[],
): void {
  const unique = [...new Set(accountIds)];
  if (unique.length === 0) {
    return;
  }
  const idList = unique.map((id) => escapeSqlStringLiteral(id)).join(", ");
  const command = `SELECT COUNT(*) AS n FROM accounts WHERE id IN (${idList})`;
  const result = spawnSync(
    execPath,
    buildWranglerArgs({
      kind: "execute-command",
      configRel,
      remote: true,
      command,
      json: true,
    }),
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error("Failed to verify account ids on remote D1");
  }
  let parsed: Array<{ results?: Array<{ n: number }>; success?: boolean }>;
  try {
    parsed = JSON.parse(result.stdout) as Array<{
      results?: Array<{ n: number }>;
      success?: boolean;
    }>;
  } catch {
    throw new Error("Failed to parse remote account verification response");
  }
  const batch = parsed[0];
  const found = batch?.results?.[0]?.n;
  if (!batch?.success || found !== unique.length) {
    const missing = unique.join(", ");
    throw new Error(`Unknown account id for card load: ${missing}`);
  }
}

await main();
