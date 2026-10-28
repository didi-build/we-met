import { readFileSync } from "node:fs";
import { NONPROD_RESOURCE_MARKERS } from "./wrangler-placeholders.mjs";
import { parseJsonc } from "./parse-jsonc.mjs";

/** @typedef {{ ok: true; normalized: string }} EmailOk */
/** @typedef {{ ok: false; reason: string }} EmailFail */

export const ACTIVATION_D1_DATABASE_NAME = NONPROD_RESOURCE_MARKERS.d1Name;

const MAX_EMAIL_LEN = 254;
const MAX_LOCAL_LEN = 64;
const MAX_DOMAIN_LEN = 253;

/** Characters that must never appear in operator-supplied email (SQL / shell safety). */
const FORBIDDEN_EMAIL_CHARS = /[\s'"\\;]/;

/** Conservative operator email: local@domain.tld (ASCII subset only). */
const ACTIVATION_EMAIL_PATTERN = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

/**
 * @param {unknown} raw
 * @returns {EmailOk | EmailFail}
 */
export function validateActivationEmail(raw) {
  if (typeof raw !== "string") {
    return { ok: false, reason: "email must be a string" };
  }
  const email = raw.trim();
  if (email.length === 0) {
    return { ok: false, reason: "email is empty" };
  }
  if (email.length > MAX_EMAIL_LEN) {
    return { ok: false, reason: "email is too long" };
  }
  if (FORBIDDEN_EMAIL_CHARS.test(email)) {
    return { ok: false, reason: "email contains forbidden characters" };
  }
  if (email.includes("--") || email.includes("/*") || email.includes("*/")) {
    return { ok: false, reason: "email contains forbidden sequences" };
  }
  if (!ACTIVATION_EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: "email does not match the allowed pattern" };
  }
  const at = email.indexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length === 0 || local.length > MAX_LOCAL_LEN) {
    return { ok: false, reason: "email local part length is invalid" };
  }
  if (domain.length === 0 || domain.length > MAX_DOMAIN_LEN) {
    return { ok: false, reason: "email domain length is invalid" };
  }
  if (local.startsWith(".") || local.endsWith(".")) {
    return { ok: false, reason: "email local part has invalid dots" };
  }
  if (domain.startsWith(".") || domain.endsWith(".")) {
    return { ok: false, reason: "email domain has invalid dots" };
  }
  return { ok: true, normalized: email.toLowerCase() };
}

/**
 * @param {string} configPath
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function assertWranglerConfigTargetsNonprodD1(configPath) {
  let parsed;
  try {
    parsed = parseJsonc(readFileSync(configPath, "utf8"));
  } catch {
    return { ok: false, reason: "could not read wrangler config" };
  }
  const entries = parsed?.d1_databases;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, reason: "wrangler config has no d1_databases bindings" };
  }
  for (const entry of entries) {
    const name = entry?.database_name;
    if (name === "we-met-db") {
      return {
        ok: false,
        reason: "refusing production D1 database_name we-met-db",
      };
    }
    if (name !== ACTIVATION_D1_DATABASE_NAME) {
      return {
        ok: false,
        reason: `refusing D1 database_name ${String(name)}; expected ${ACTIVATION_D1_DATABASE_NAME}`,
      };
    }
  }
  return { ok: true };
}

/**
 * @param {string} normalizedEmail lowercased, validated email
 * @param {string} updatedAtIso UTC ISO-8601 timestamp
 */
export function buildActivationUpdateCommand(normalizedEmail, updatedAtIso) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAtIso)) {
    throw new Error("updatedAtIso must be a UTC ISO-8601 string");
  }
  const sql =
    "UPDATE accounts SET status = 'active', updated_at = '" +
    updatedAtIso +
    "' WHERE email = '" +
    normalizedEmail +
    "' AND status IN ('waitlisted', 'active');";
  return sql;
}

/** @typedef {'success' | 'not_found' | 'ambiguous' | 'unparseable'} ActivationRowOutcome */

export const WRANGLER_D1_EXECUTE_SPAWN_OPTIONS = {
  encoding: "utf8",
  shell: false,
};

/**
 * @param {string} configPath
 * @param {string} sqlCommand
 * @returns {string[]}
 */
export function buildWranglerD1ExecuteArgv(configPath, sqlCommand) {
  return [
    "wrangler",
    "d1",
    "execute",
    "WE_MET_DB",
    "--remote",
    "-c",
    configPath,
    "--command",
    sqlCommand,
    "--json",
  ];
}

/**
 * @param {string} stdout
 * @returns {number | null}
 */
export function parseWranglerD1ExecuteRowChanges(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    const changes = parsed?.[0]?.meta?.changes;
    if (typeof changes === "number") {
      return changes;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {number | null} changes
 * @returns {ActivationRowOutcome}
 */
export function resolveActivationRowOutcome(changes) {
  if (changes === null) {
    return "unparseable";
  }
  if (changes === 0) {
    return "not_found";
  }
  if (changes === 1) {
    return "success";
  }
  return "ambiguous";
}

/**
 * @param {string} sql
 * @param {string} normalizedEmail
 */
export function emailAppearsOnlyInWhereLiteral(sql, normalizedEmail) {
  const literal = `WHERE email = '${normalizedEmail}'`;
  if (!sql.includes(literal)) {
    return false;
  }
  const escaped = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutWhere = sql.replace(
    new RegExp(`WHERE email = '${escaped}'`),
    "WHERE email = ''",
  );
  return !withoutWhere.includes(normalizedEmail);
}

/**
 * @param {string} email validated normalized email
 */
export function maskActivationEmailForLogs(email) {
  if (email) {
    console.log(`::add-mask::${email}`);
  }
}

/**
 * @param {string} id
 */
export function maskD1DatabaseId(id) {
  if (id) {
    console.log(`::add-mask::${id}`);
  }
}
