/**
 * Plan and apply Cloudflare D1 / R2 resources declared in Wrangler config.
 */

export const NONPROD_NAME_SUFFIX = "-nonprod";
export const DEFAULT_PROVISION_D1_IDS_FILE = "provision-d1-ids.json";

/** @typedef {'production' | 'nonprod'} ProvisionTarget */

/**
 * @typedef {import('./cloudflare-provision-api.mjs').CloudflareApiClient} ProvisionApiClient
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
  let baseName = databaseName;
  if (target === "nonprod" && baseName.endsWith(NONPROD_NAME_SUFFIX)) {
    baseName = baseName.slice(0, -NONPROD_NAME_SUFFIX.length);
  }
  const slug = baseName.replace(/-/g, "_").toUpperCase();
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
 * @param {Record<string, unknown>} mainConfig
 * @param {Record<string, unknown>} consumerConfig
 * @param {ProvisionTarget} target
 * @param {{ includeD1?: boolean, includeR2?: boolean }} [options]
 */
export function validateConsumerMatchesApp(
  mainConfig,
  consumerConfig,
  target,
  options = {},
) {
  const app = collectDeclaredResources(mainConfig, null, target, options);
  const combined = collectDeclaredResources(
    mainConfig,
    consumerConfig,
    target,
    options,
  );
  const errors = [];
  for (const kind of ["d1", "r2"]) {
    const appNames = [...app[kind]].sort();
    const combinedNames = [...combined[kind]].sort();
    if (appNames.join(",") !== combinedNames.join(",")) {
      errors.push(
        `follow-up consumer ${kind} names for ${target} must match the app Worker (${appNames.join(", ") || "none"} vs ${combinedNames.join(", ") || "none"})`,
      );
    }
  }
  return errors;
}

export function validateDeclaredNames(declaredD1, declaredR2, target) {
  const errors = [];
  for (const name of [...declaredD1, ...declaredR2]) {
    const message = assertNameAllowedForTarget(name, target);
    if (message) errors.push(message);
  }
  return errors;
}

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
 * @param {string[]} declaredNames
 * @param {ProvisionApiClient} api
 */
export async function lookupDeclaredD1(declaredNames, api) {
  const rows = [];
  for (const name of declaredNames) {
    const row = await api.getD1Database(name);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * @param {string[]} declaredNames
 * @param {ProvisionApiClient} api
 */
export async function lookupDeclaredR2(declaredNames, api) {
  const names = [];
  for (const name of declaredNames) {
    if (await api.r2BucketExists(name)) names.push(name);
  }
  return names;
}

/**
 * @param {Record<string, string>} resolvedD1Ids
 * @param {ProvisionTarget} target
 * @param {Record<string, string | undefined>} env
 */
export function validateD1IdsAgainstEnv(resolvedD1Ids, target, env) {
  const errors = [];
  for (const databaseName of Object.keys(resolvedD1Ids)) {
    const cloudflareId = resolvedD1Ids[databaseName];
    const envName = d1EnvVarForDatabaseName(databaseName, target);
    const expected = env[envName]?.trim();
    if (!expected) {
      continue;
    }
    if (expected !== cloudflareId) {
      errors.push(
        `D1 "${databaseName}" id from Cloudflare does not match ${envName}; update the GitHub secret, shell export, or provision file`,
      );
    }
  }
  return errors;
}

/**
 * @param {Record<string, string>} resolvedD1Ids
 * @param {(id: string) => void} maskId
 */
export function maskResolvedD1Ids(resolvedD1Ids, maskId) {
  for (const id of Object.values(resolvedD1Ids)) {
    if (id?.trim()) maskId(id.trim());
  }
}

/**
 * @param {ProvisionPlanAction[]} plan
 * @param {ProvisionApiClient} api
 * @param {{ name: string, uuid: string }[]} existingD1
 */
export async function executeProvisionPlan(plan, api, existingD1) {
  const d1ByName = new Map(existingD1.map((row) => [row.name, row.uuid]));
  const log = [];
  const resolvedD1Ids = {};

  for (const step of plan) {
    if (step.action === "skip") {
      if (step.kind === "d1") {
        const uuid = d1ByName.get(step.name);
        if (uuid) resolvedD1Ids[step.name] = uuid;
        log.push({ level: "info", message: `D1 ${step.name} present` });
      } else {
        log.push({ level: "info", message: `R2 ${step.name} present` });
      }
      continue;
    }
    if (step.kind === "d1") {
      const created = await api.createD1Database(step.name);
      resolvedD1Ids[step.name] = created.uuid;
      log.push({ level: "info", message: `D1 ${step.name} created` });
    } else {
      await api.createR2Bucket(step.name);
      log.push({ level: "info", message: `R2 ${step.name} created` });
    }
  }

  return { log, resolvedD1Ids };
}

/**
 * @param {Record<string, string>} resolvedD1Ids
 */
export function formatProvisionD1IdsFile(resolvedD1Ids) {
  return `${JSON.stringify({ d1: resolvedD1Ids }, null, 2)}\n`;
}
