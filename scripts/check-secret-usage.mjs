import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOWS_DIR = ".github/workflows";
const ALLOWED_BOOTSTRAP_FILE = "bootstrap.yml";
const ALLOWED_MIGRATE_NONPROD_FILES = new Set([
  "migrate-nonprod.yml",
  "provision-nonprod-main.yml",
]);
const ALLOWED_DEPLOY_PRODUCTION_FILE = "deploy-production.yml";
const ALLOWED_DEPLOY_STAGING_FILE = "deploy-staging.yml";
const SECRET_NAME = "BOOTSTRAP_TOKEN";
const MIGRATE_NONPROD_SECRET = "CLOUDFLARE_API_TOKEN_MIGRATE_NONPROD";
const MIGRATE_NONPROD_ENV = "migrate-nonprod";
const CONSUMER_PRODUCTION_SECRET = "CLOUDFLARE_API_TOKEN_CONSUMER_PRODUCTION";
const STAGING_SECRET = "CLOUDFLARE_API_TOKEN_STAGING";

/**
 * @param {string} workflowsDir
 * @returns {string[]}
 */
export function findBootstrapTokenViolations(workflowsDir) {
  if (!existsSync(workflowsDir)) {
    return [];
  }
  const entries = readdirSync(workflowsDir, { withFileTypes: true });
  const violations = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    if (name === ALLOWED_BOOTSTRAP_FILE) continue;
    const text = readFileSync(join(workflowsDir, name), "utf8");
    if (text.includes(SECRET_NAME)) {
      violations.push(name);
    }
  }
  return violations.sort();
}

/**
 * @param {string} workflowsDir
 * @returns {string[]}
 */
export function findMigrateNonprodCredentialViolations(workflowsDir) {
  if (!existsSync(workflowsDir)) {
    return [];
  }
  const violations = [];
  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    if (ALLOWED_MIGRATE_NONPROD_FILES.has(name)) continue;
    const text = readFileSync(join(workflowsDir, name), "utf8");
    if (text.includes(MIGRATE_NONPROD_SECRET) || text.includes(MIGRATE_NONPROD_ENV)) {
      violations.push(name);
    }
  }
  return violations.sort();
}

/**
 * @param {string} workflowsDir
 * @returns {string[]}
 */
export function findStagingCredentialViolations(workflowsDir) {
  if (!existsSync(workflowsDir)) {
    return [];
  }
  const violations = [];
  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    if (name === ALLOWED_DEPLOY_STAGING_FILE) continue;
    const text = readFileSync(join(workflowsDir, name), "utf8");
    if (text.includes(STAGING_SECRET)) {
      violations.push(name);
    }
  }
  return violations.sort();
}

export function findConsumerProductionCredentialViolations(workflowsDir) {
  if (!existsSync(workflowsDir)) {
    return [];
  }
  const violations = [];
  for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    if (name === ALLOWED_DEPLOY_PRODUCTION_FILE) continue;
    const text = readFileSync(join(workflowsDir, name), "utf8");
    if (text.includes(CONSUMER_PRODUCTION_SECRET)) {
      violations.push(name);
    }
  }
  return violations.sort();
}

function runCli() {
  const bootstrapViolations = findBootstrapTokenViolations(WORKFLOWS_DIR);
  if (bootstrapViolations.length > 0) {
    console.error(
      `${SECRET_NAME} must only appear in .github/workflows/${ALLOWED_BOOTSTRAP_FILE}. Offenders:\n`,
    );
    for (const file of bootstrapViolations) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  const migrateViolations = findMigrateNonprodCredentialViolations(WORKFLOWS_DIR);
  if (migrateViolations.length > 0) {
    console.error(
      `${MIGRATE_NONPROD_SECRET} and environment name ${MIGRATE_NONPROD_ENV} must only appear in ${[...ALLOWED_MIGRATE_NONPROD_FILES].map((f) => `.github/workflows/${f}`).join(" or ")}. Offenders:\n`,
    );
    for (const file of migrateViolations) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  const consumerViolations = findConsumerProductionCredentialViolations(WORKFLOWS_DIR);
  if (consumerViolations.length > 0) {
    console.error(
      `${CONSUMER_PRODUCTION_SECRET} must only appear in .github/workflows/${ALLOWED_DEPLOY_PRODUCTION_FILE}. Offenders:\n`,
    );
    for (const file of consumerViolations) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  const stagingViolations = findStagingCredentialViolations(WORKFLOWS_DIR);
  if (stagingViolations.length > 0) {
    console.error(
      `${STAGING_SECRET} must only appear in .github/workflows/${ALLOWED_DEPLOY_STAGING_FILE}. Offenders:\n`,
    );
    for (const file of stagingViolations) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runCli();
}
