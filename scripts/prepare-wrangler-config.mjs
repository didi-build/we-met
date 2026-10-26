#!/usr/bin/env node
/**
 * Substitute D1 database_id placeholders and write a deploy-ready Wrangler config.
 *
 * Environment:
 *   WE_MET_D1_DATABASE_ID_PRODUCTION / WE_MET_D1_DATABASE_ID_NONPROD — optional when
 *     WE_MET_PROVISION_D1_IDS_FILE (or provision-d1-ids.json) is present from provision step
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertOutputInRepoRoot } from "./lib/assert-repo-root-output.mjs";
import {
  assertNoPlaceholderLeft,
  D1_PLACEHOLDER_NONPROD,
  D1_PLACEHOLDER_PRODUCTION,
  loadProvisionD1IdsFile,
  resolveD1IdsForPrepareTarget,
} from "./lib/d1-id-resolution.mjs";
import { parseJsonc } from "./lib/parse-jsonc.mjs";

const SOURCE = resolve("wrangler.jsonc");
const SOURCE_STAGING = resolve("wrangler.staging.jsonc");
const CONSUMER_DIR = resolve("workers/we-met-followup-email-consumer");
const CONSUMER_SOURCE_PRODUCTION = resolve(CONSUMER_DIR, "wrangler.production.jsonc");
const CONSUMER_SOURCE_NONPROD = resolve(CONSUMER_DIR, "wrangler.nonprod.jsonc");

function usage() {
  console.error(
    "Usage: prepare-wrangler-config.mjs --target <production|preview|staging|d1-migrate-nonprod|consumer-production|consumer-nonprod> --output <path>",
  );
  process.exit(1);
}

function assertConsumerOutputBesideSource(outputPath, sourcePath) {
  const resolved = resolve(outputPath);
  if (dirname(resolved) !== dirname(sourcePath)) {
    console.error(`Consumer output must sit next to ${sourcePath} (got ${resolved}).`);
    process.exit(1);
  }
}

function parseArgs(argv) {
  let target = null;
  let output = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") target = argv[++i];
    else if (arg === "--output") output = argv[++i];
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }
  if (!target || !output) usage();
  return { target, output: resolve(output) };
}

function replaceD1Ids(text, { productionId, nonprodId }) {
  let out = text;
  if (productionId) {
    out = out.replaceAll(D1_PLACEHOLDER_PRODUCTION, productionId);
  }
  if (nonprodId) {
    out = out.replaceAll(D1_PLACEHOLDER_NONPROD, nonprodId);
  }
  return out;
}

function buildD1MigrateNonprodConfig(config, nonprodId) {
  const previewD1 = config.previews?.d1_databases?.[0];
  if (!previewD1) {
    console.error("wrangler.jsonc previews.d1_databases[0] is required.");
    process.exit(1);
  }
  const migrationsDir = previewD1.migrations_dir ?? "migrations";
  return {
    $schema: config.$schema,
    migrations_dir: migrationsDir,
    d1_databases: [
      {
        binding: previewD1.binding,
        database_name: previewD1.database_name,
        database_id: nonprodId,
        migrations_dir: migrationsDir,
      },
    ],
  };
}

function prepareConsumerConfig(sourcePath, outputPath, { productionId, nonprodId }) {
  assertConsumerOutputBesideSource(outputPath, sourcePath);
  const sourceText = readFileSync(sourcePath, "utf8");
  const text = replaceD1Ids(sourceText, { productionId, nonprodId });
  const prodErr = productionId
    ? assertNoPlaceholderLeft(text, D1_PLACEHOLDER_PRODUCTION, "production")
    : null;
  if (prodErr) {
    console.error(prodErr);
    process.exit(1);
  }
  const nonprodErr = nonprodId
    ? assertNoPlaceholderLeft(text, D1_PLACEHOLDER_NONPROD, "non-prod")
    : null;
  if (nonprodErr) {
    console.error(nonprodErr);
    process.exit(1);
  }
  writeFileSync(outputPath, text, "utf8");
}

function loadProvisionFileFromEnv() {
  const path = process.env.WE_MET_PROVISION_D1_IDS_FILE?.trim();
  if (!path) return loadProvisionD1IdsFile(undefined);
  return loadProvisionD1IdsFile(path);
}

function main() {
  const { target, output } = parseArgs(process.argv.slice(2));
  const isConsumerTarget =
    target === "consumer-production" || target === "consumer-nonprod";
  if (!isConsumerTarget) {
    assertOutputInRepoRoot(output);
  }
  const sourcePath = target === "staging" ? SOURCE_STAGING : SOURCE;
  const sourceText = readFileSync(sourcePath, "utf8");
  const config = parseJsonc(sourceText);
  const provisionFile = loadProvisionFileFromEnv();
  const resolved = resolveD1IdsForPrepareTarget(target, process.env, provisionFile);
  if (resolved.error) {
    console.error(resolved.error);
    process.exit(1);
  }

  if (target === "production") {
    const productionId = resolved.productionId;
    const text = replaceD1Ids(sourceText, { productionId });
    const err = assertNoPlaceholderLeft(text, D1_PLACEHOLDER_PRODUCTION, "production");
    if (err) {
      console.error(err);
      process.exit(1);
    }
    writeFileSync(output, text, "utf8");
    return;
  }

  if (target === "preview") {
    const nonprodId = resolved.nonprodId;
    const productionId = process.env.WE_MET_D1_DATABASE_ID_PRODUCTION?.trim();
    let text = replaceD1Ids(sourceText, {
      productionId: productionId || D1_PLACEHOLDER_PRODUCTION,
      nonprodId,
    });
    if (!productionId) {
      console.error(
        "Warning: WE_MET_D1_DATABASE_ID_PRODUCTION unset; production placeholder left in file (preview deploy uses previews block only).",
      );
    }
    const err = assertNoPlaceholderLeft(text, D1_PLACEHOLDER_NONPROD, "non-prod");
    if (err) {
      console.error(err);
      process.exit(1);
    }
    writeFileSync(output, text, "utf8");
    return;
  }

  if (target === "staging") {
    const nonprodId = resolved.nonprodId;
    const text = replaceD1Ids(sourceText, { nonprodId });
    const err = assertNoPlaceholderLeft(text, D1_PLACEHOLDER_NONPROD, "non-prod");
    if (err) {
      console.error(err);
      process.exit(1);
    }
    writeFileSync(output, text, "utf8");
    return;
  }

  if (target === "d1-migrate-nonprod") {
    const nonprodId = resolved.nonprodId;
    const minimal = buildD1MigrateNonprodConfig(config, nonprodId);
    writeFileSync(output, `${JSON.stringify(minimal, null, 2)}\n`, "utf8");
    return;
  }

  if (target === "consumer-production") {
    prepareConsumerConfig(CONSUMER_SOURCE_PRODUCTION, output, {
      productionId: resolved.productionId,
    });
    return;
  }

  if (target === "consumer-nonprod") {
    prepareConsumerConfig(CONSUMER_SOURCE_NONPROD, output, {
      nonprodId: resolved.nonprodId,
    });
    return;
  }

  console.error(`Unknown --target: ${target}`);
  usage();
}

main();
