import { readFileSync } from "node:fs";
import {
  D1_PLACEHOLDER_PRODUCTION,
  NONPROD_RESOURCE_MARKERS,
} from "./wrangler-placeholders.mjs";
import { parseJsonc } from "./parse-jsonc.mjs";

/** @typedef {{ ok: true; normalized: string }} EmailOk */
/** @typedef {{ ok: false; reason: string }} EmailFail */

export const ACTIVATION_D1_DATABASE_NAME = NONPROD_RESOURCE_MARKERS.d1Name;
export const ACTIVATION_D1_BINDING = "WE_MET_DB";

const MAX_EMAIL_LEN = 254;
const MAX_LOCAL_LEN = 64;
const MAX_DOMAIN_LEN = 253;

/** Characters that must never appear in operator-supplied email (SQL / shell safety). */
const FORBIDDEN_EMAIL_CHARS = /[\s'"\\;]/;

/** Conservative operator email: local@domain.tld (ASCII subset only). */
const ACTIVATION_EMAIL_PATTERN = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

export const ACTIVATION_EMAIL_CONTROL_CHAR_PATTERN =
  /[\u0000-\u001f\u007f\u2028\u2029]/;

export const ACTIVATION_EVENT_EMAIL_CONTROL_REJECTED =
  "workflow dispatch email input contains control characters";

/**
 * @param {string} raw
 */
export function activationEmailHasControlCharacters(raw) {
  return ACTIVATION_EMAIL_CONTROL_CHAR_PATTERN.test(raw);
}

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
  if (FORBIDDEN_EMAIL_CHARS.test(email)) {
    return { ok: false, reason: "email contains forbidden characters" };
  }
  if (email.includes("/*") || email.includes("*/")) {
    return { ok: false, reason: "email contains forbidden sequences" };
  }
  if (!ACTIVATION_EMAIL_PATTERN.test(email)) {
    return { ok: false, reason: "email does not match the allowed pattern" };
  }
  const at = email.indexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain.includes("xn--")) {
    return { ok: false, reason: "email domain punycode (xn--) is not allowed" };
  }
  if (email.includes("--")) {
    return { ok: false, reason: "email contains forbidden sequences" };
  }
  if (local.length === 0 || local.length > MAX_LOCAL_LEN) {
    return { ok: false, reason: "email local part length is invalid" };
  }
  if (domain.length === 0 || domain.length > MAX_DOMAIN_LEN) {
    return { ok: false, reason: "email domain length is invalid" };
  }
  if (email.length > MAX_EMAIL_LEN) {
    return { ok: false, reason: "email is too long" };
  }
  if (local.startsWith(".") || local.endsWith(".")) {
    return { ok: false, reason: "email local part has invalid dots" };
  }
  if (domain.startsWith(".") || domain.endsWith(".")) {
    return { ok: false, reason: "email domain has invalid dots" };
  }
  if (local.includes("..") || domain.includes("..")) {
    return { ok: false, reason: "email contains consecutive dots" };
  }
  if (!/^[a-zA-Z0-9]/.test(local)) {
    return { ok: false, reason: "email local part has invalid leading character" };
  }
  for (const label of domain.split(".")) {
    if (label.length === 0 || label.length > 63) {
      return { ok: false, reason: "email domain label length is invalid" };
    }
    if (label.startsWith("-") || label.endsWith("-")) {
      return { ok: false, reason: "email domain label has invalid hyphens" };
    }
  }
  return { ok: true, normalized: email.toLowerCase() };
}

/**
 * @param {string | undefined} eventPath
 * @param {(path: string, encoding: BufferEncoding) => string} [readFile]
 * @returns {{ ok: true; email: string } | { ok: false; reason: string }}
 */
export function readWorkflowDispatchEmailFromGithubEvent(
  eventPath,
  readFile = readFileSync,
) {
  if (!eventPath || typeof eventPath !== "string") {
    return { ok: false, reason: "GITHUB_EVENT_PATH is missing" };
  }
  try {
    const parsed = JSON.parse(readFile(eventPath, "utf8"));
    const email = parsed?.inputs?.email;
    if (typeof email !== "string" || email.length === 0) {
      return { ok: false, reason: "workflow dispatch email input is missing" };
    }
    if (activationEmailHasControlCharacters(email)) {
      return { ok: false, reason: ACTIVATION_EVENT_EMAIL_CONTROL_REJECTED };
    }
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      return { ok: false, reason: "workflow dispatch email input is missing" };
    }
    return { ok: true, email: trimmed };
  } catch {
    return { ok: false, reason: "could not read GITHUB_EVENT_PATH" };
  }
}

/**
 * @param {string | undefined} cliEmail
 * @param {NodeJS.ProcessEnv} env
 * @param {(path: string, encoding: BufferEncoding) => string} [readFile]
 * @returns {{
 *   ok: true;
 *   email: string;
 *   maskDispatchEmailFirst: boolean;
 * } | { ok: false; reason: string }}
 */
export function resolveActivationEmailSource(cliEmail, env, readFile = readFileSync) {
  if (cliEmail) {
    return { ok: true, email: cliEmail, maskDispatchEmailFirst: false };
  }
  const fromEvent = readWorkflowDispatchEmailFromGithubEvent(
    env.GITHUB_EVENT_PATH,
    readFile,
  );
  if (!fromEvent.ok) {
    return fromEvent;
  }
  return {
    ok: true,
    email: fromEvent.email,
    maskDispatchEmailFirst: true,
  };
}

/**
 * @param {string} email
 * @param {(line: string) => void} [logLine]
 */
export function logActivationEmailMaskLine(
  email,
  logLine = (line) => console.log(line),
) {
  logLine(`::add-mask::${email}`);
}

/**
 * @param {unknown} parsed
 * @param {string} expectedDatabaseId
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function assertWranglerConfigD1Binding(parsed, expectedDatabaseId) {
  if (!expectedDatabaseId || typeof expectedDatabaseId !== "string") {
    return { ok: false, reason: "expected non-prod D1 database id is missing" };
  }
  if (parsed?.env !== undefined) {
    return { ok: false, reason: "wrangler config must not define env blocks" };
  }
  if (parsed?.previews !== undefined) {
    return { ok: false, reason: "wrangler config must not define previews blocks" };
  }
  const entries = parsed?.d1_databases;
  if (!Array.isArray(entries) || entries.length !== 1) {
    return {
      ok: false,
      reason: "wrangler config must have exactly one d1_databases entry",
    };
  }
  const entry = entries[0];
  if (entry?.binding !== ACTIVATION_D1_BINDING) {
    return {
      ok: false,
      reason: `refusing D1 binding ${String(entry?.binding)}; expected ${ACTIVATION_D1_BINDING}`,
    };
  }
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
  const id = entry?.database_id;
  if (!id || typeof id !== "string" || id.trim() === "") {
    return { ok: false, reason: "D1 database_id is missing" };
  }
  if (id === D1_PLACEHOLDER_PRODUCTION) {
    return { ok: false, reason: "refusing production D1 placeholder database_id" };
  }
  if (id !== expectedDatabaseId) {
    return { ok: false, reason: "D1 database_id does not match expected non-prod id" };
  }
  return { ok: true };
}

/**
 * @param {string} configPath
 * @param {string} expectedDatabaseId
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function assertWranglerConfigTargetsNonprodD1(configPath, expectedDatabaseId) {
  let parsed;
  try {
    parsed = parseJsonc(readFileSync(configPath, "utf8"));
  } catch {
    return { ok: false, reason: "could not read wrangler config" };
  }
  return assertWranglerConfigD1Binding(parsed, expectedDatabaseId);
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
    const row = parsed?.[0];
    if (!row || row.success !== true) {
      return null;
    }
    const changes = row.meta?.changes;
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
