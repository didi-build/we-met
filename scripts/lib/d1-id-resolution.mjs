import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_PROVISION_D1_IDS_FILE,
  d1EnvVarForDatabaseName,
} from "./provision-resources.mjs";
import {
  D1_PLACEHOLDER_NONPROD,
  D1_PLACEHOLDER_PRODUCTION,
} from "./wrangler-placeholders.mjs";

const PRIMARY_PRODUCTION_DB = "we-met-db";
const PRIMARY_NONPROD_DB = "we-met-db-nonprod";

/**
 * @param {string | undefined} filePath
 */
export function loadProvisionD1IdsFile(filePath) {
  const resolved = resolve(filePath || DEFAULT_PROVISION_D1_IDS_FILE);
  try {
    const raw = readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw);
    const map = parsed?.d1;
    if (!map || typeof map !== "object") {
      throw new Error("provision D1 ids file must contain a d1 object");
    }
    const out = {};
    for (const [name, id] of Object.entries(map)) {
      if (typeof id === "string" && id.trim()) out[name] = id.trim();
    }
    return out;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : null;
    if (code === "ENOENT") return null;
    throw err;
  }
}

/**
 * @param {string} databaseName
 * @param {'production' | 'nonprod'} target
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, string> | null} provisionFile
 */
export function resolveD1IdForDatabaseName(databaseName, target, env, provisionFile) {
  const envName = d1EnvVarForDatabaseName(databaseName, target);
  const fromEnv = env[envName]?.trim();
  const fromFile = provisionFile?.[databaseName]?.trim();
  if (fromEnv && fromFile && fromEnv !== fromFile) {
    return {
      error: `${envName} disagrees with the provision D1 ids file for "${databaseName}"`,
    };
  }
  const id = fromEnv || fromFile;
  if (!id) {
    return {
      error: `missing D1 id for "${databaseName}" (set ${envName} or run provision with --output)`,
    };
  }
  return { id };
}

/**
 * @param {'production' | 'preview' | 'd1-migrate-nonprod' | 'consumer-production' | 'consumer-nonprod'} target
 * @param {Record<string, string | undefined>} env
 * @param {Record<string, string> | null} provisionFile
 */
export function resolveD1IdsForPrepareTarget(target, env, provisionFile) {
  if (target === "production" || target === "consumer-production") {
    const { id, error } = resolveD1IdForDatabaseName(
      PRIMARY_PRODUCTION_DB,
      "production",
      env,
      provisionFile,
    );
    if (error) return { error };
    return { productionId: id };
  }
  if (
    target === "preview" ||
    target === "d1-migrate-nonprod" ||
    target === "consumer-nonprod"
  ) {
    const { id, error } = resolveD1IdForDatabaseName(
      PRIMARY_NONPROD_DB,
      "nonprod",
      env,
      provisionFile,
    );
    if (error) return { error };
    return { nonprodId: id };
  }
  return { error: `unknown prepare target ${target}` };
}

export function assertNoPlaceholderLeft(text, placeholder, label) {
  if (text.includes(placeholder)) {
    return `Failed to substitute ${label} D1 database_id.`;
  }
  return null;
}

export { D1_PLACEHOLDER_NONPROD, D1_PLACEHOLDER_PRODUCTION };
