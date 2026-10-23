/**
 * Plan and apply Cloudflare D1 / R2 resources declared in Wrangler config.
 * Wrangler CLI calls are injectable for unit tests.
 */

export const NONPROD_NAME_SUFFIX = "-nonprod";

/** @typedef {'production' | 'nonprod'} ProvisionTarget */

/**
 * @typedef {object} WranglerRunner
 * @property {() => Promise<{ name: string, uuid: string }[]>} listD1Databases
 * @property {() => Promise<string[]>} listR2Buckets
 * @property {(name: string) => Promise<{ name: string, uuid: string }>} createD1Database
 * @property {(name: string) => Promise<void>} createR2Bucket
 */

/**
 * @typedef {object} ProvisionResource
 * @property {'d1' | 'r2'} kind
 * @property {string} name
 */

/**
 * @typedef {object} ProvisionPlanAction
 * @property {'create' | 'skip'} action
 * @property {'d1' | 'r2'} kind
 * @property {string} name
 */

const KNOWN_D1_ENV_BY_TARGET = {
  production: {
    "we-met-db": "WE_MET_D1_DATABASE_ID_PRODUCTION",
  },
  nonprod: {
    "we-met-db-nonprod": "WE_MET_D1_DATABASE_ID_NONPROD",
  },
};

export function d1EnvVarForDatabaseName(databaseName, target) {
  const known = KNOWN_D1_ENV_BY_TARGET[target]?.[databaseName];
  if (known) return known;
  const slug = databaseName.replace(/-/g, "_").toUpperCase();
  const suffix = target === "production" ? "PRODUCTION" : "NONPROD";
  return `WE_MET_D1_DATABASE_ID_${slug}_${suffix}`;
}

export function assertNameAllowedForTarget(name, target) {
  const hasSuffix = name.endsWith(NONPROD_NAME_SUFFIX);
  if (target === "nonprod" && !hasSuffix) {
    return `refusing non-prod provision for "${name}" (name must end with "${NONPROD_NAME_SUFFIX}")`;
  }
  if (target === "production" && hasSuffix) {
    return `refusing production provision for "${name}" (name must not end with "${NONPROD_NAME_SUFFIX}")`;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} mainConfig
 * @param {Record<string, unknown> | null} consumerConfig
 * @param {ProvisionTarget} target
 */
/**
 * @param {Record<string, unknown>} mainConfig
 * @param {Record<string, unknown> | null} consumerConfig
 * @param {ProvisionTarget} target
 * @param {{ includeD1?: boolean, includeR2?: boolean }} [options]
 */
export function collectDeclaredResources(
  mainConfig,
  consumerConfig,
  target,
  options = {},
) {
  const includeD1 = options.includeD1 ?? true;
  const includeR2 = options.includeR2 ?? true;
  const block =
    target === "production" ? mainConfig : (mainConfig.previews ?? mainConfig);
  const d1Names = new Set();
  const r2Names = new Set();

  if (includeD1) {
    for (const row of block.d1_databases ?? []) {
      if (row?.database_name) d1Names.add(row.database_name);
    }
  }
  if (includeR2) {
    for (const row of block.r2_buckets ?? []) {
      if (row?.bucket_name) r2Names.add(row.bucket_name);
    }
  }

  if (consumerConfig) {
    if (includeD1) {
      for (const row of consumerConfig.d1_databases ?? []) {
        if (row?.database_name) d1Names.add(row.database_name);
      }
    }
    if (includeR2) {
      for (const row of consumerConfig.r2_buckets ?? []) {
        if (row?.bucket_name) r2Names.add(row.bucket_name);
      }
    }
  }

  return {
    d1: [...d1Names].sort(),
    r2: [...r2Names].sort(),
  };
}

/**
 * @param {string[]} declaredD1
 * @param {string[]} declaredR2
 * @param {ProvisionTarget} target
 */
export function validateDeclaredNames(declaredD1, declaredR2, target) {
  const errors = [];
  for (const name of [...declaredD1, ...declaredR2]) {
    const message = assertNameAllowedForTarget(name, target);
    if (message) errors.push(message);
  }
  return errors;
}

/**
 * @param {string[]} declaredD1
 * @param {string[]} declaredR2
 * @param {{ name: string }[]} existingD1
 * @param {string[]} existingR2
 */
export function buildProvisionPlan(declaredD1, declaredR2, existingD1, existingR2) {
  const d1Set = new Set(existingD1.map((row) => row.name));
  const r2Set = new Set(existingR2);
  const actions = [];

  for (const name of declaredD1) {
    actions.push({
      action: d1Set.has(name) ? "skip" : "create",
      kind: "d1",
      name,
    });
  }
  for (const name of declaredR2) {
    actions.push({
      action: r2Set.has(name) ? "skip" : "create",
      kind: "r2",
      name,
    });
  }
  return actions;
}

/**
 * @param {Record<string, string>} resolvedD1Ids database_name -> uuid
 * @param {ProvisionTarget} target
 * @param {Record<string, string | undefined>} env
 */
export function validateD1IdsAgainstEnv(resolvedD1Ids, target, env) {
  const errors = [];
  for (const [databaseName, cloudflareId] of Object.entries(resolvedD1Ids)) {
    const envName = d1EnvVarForDatabaseName(databaseName, target);
    const expected = env[envName]?.trim();
    if (!expected) {
      errors.push(
        `D1 "${databaseName}" resolved to ${maskIdForLog(cloudflareId, target)} but ${envName} is unset; add the GitHub environment variable with that id before deploy`,
      );
      continue;
    }
    if (expected !== cloudflareId) {
      errors.push(
        `D1 "${databaseName}" id from Cloudflare (${maskIdForLog(cloudflareId, target)}) does not match ${envName}`,
      );
    }
  }
  return errors;
}

export function maskIdForLog(id, target) {
  if (target === "nonprod") return "***";
  return id;
}

/**
 * @param {ProvisionPlanAction[]} plan
 * @param {WranglerRunner} wrangler
 * @param {{ name: string, uuid: string }[]} existingD1
 */
export async function executeProvisionPlan(plan, wrangler, existingD1) {
  const d1ByName = new Map(existingD1.map((row) => [row.name, row.uuid]));
  const log = [];
  const resolvedD1Ids = { ...Object.fromEntries(d1ByName) };

  for (const step of plan) {
    if (step.action === "skip") {
      if (step.kind === "d1") {
        log.push({ level: "info", message: `D1 ${step.name} already exists` });
      } else {
        log.push({ level: "info", message: `R2 ${step.name} already exists` });
      }
      continue;
    }
    if (step.kind === "d1") {
      const created = await wrangler.createD1Database(step.name);
      resolvedD1Ids[step.name] = created.uuid;
      log.push({ level: "info", message: `D1 ${step.name} created` });
    } else {
      await wrangler.createR2Bucket(step.name);
      log.push({ level: "info", message: `R2 ${step.name} created` });
    }
  }

  return { log, resolvedD1Ids };
}

/**
 * @param {import('node:child_process').execFile} execFile
 * @param {{ accountId?: string }} options
 * @returns {WranglerRunner}
 */
export function createWranglerRunner(execFile, options = {}) {
  const env = { ...process.env };
  if (options.accountId) {
    env.CLOUDFLARE_ACCOUNT_ID = options.accountId;
  }

  async function runWranglerJson(args) {
    const { stdout, stderr, error } = await new Promise((resolve) => {
      execFile(
        "npx",
        ["wrangler", ...args, "--json"],
        { env, encoding: "utf8" },
        resolve,
      );
    });
    if (error) {
      const detail = stderr?.trim() || stdout?.trim() || error.message;
      throw new Error(`wrangler ${args.join(" ")} failed: ${detail}`);
    }
    const text = stdout.trim();
    if (!text) return null;
    return JSON.parse(text);
  }

  return {
    async listD1Databases() {
      const data = await runWranglerJson(["d1", "list"]);
      const rows = Array.isArray(data) ? data : (data?.result ?? []);
      return rows.map((row) => ({
        name: row.name,
        uuid: row.uuid ?? row.database_id ?? row.id,
      }));
    },
    async listR2Buckets() {
      const data = await runWranglerJson(["r2", "bucket", "list"]);
      const rows = Array.isArray(data)
        ? data
        : (data?.result?.buckets ?? data?.buckets ?? []);
      return rows
        .map((row) => (typeof row === "string" ? row : row.name))
        .filter(Boolean);
    },
    async createD1Database(name) {
      const data = await runWranglerJson(["d1", "create", name]);
      const uuid =
        data?.uuid ??
        data?.database_id ??
        data?.result?.uuid ??
        data?.result?.database_id;
      if (!uuid) {
        throw new Error(`wrangler d1 create ${name} did not return a database id`);
      }
      return { name, uuid };
    },
    async createR2Bucket(name) {
      await runWranglerJson(["r2", "bucket", "create", name]);
    },
  };
}
