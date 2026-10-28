import { parse as parseYaml } from "yaml";

export const EXPECTED_WORKFLOW_PERMISSIONS = { contents: "read" };

/**
 * @param {unknown} permissions
 * @returns {Record<string, string> | null}
 */
export function normalizePermissionsValue(permissions) {
  if (permissions === null || permissions === undefined) {
    return null;
  }
  if (typeof permissions === "string") {
    return { __level__: permissions.toLowerCase().trim() };
  }
  if (typeof permissions === "object" && !Array.isArray(permissions)) {
    /** @type {Record<string, string>} */
    const map = {};
    for (const [key, value] of Object.entries(permissions)) {
      if (value === null || value === undefined) {
        continue;
      }
      map[String(key).toLowerCase()] = String(value).toLowerCase().trim();
    }
    return map;
  }
  return { __invalid__: "true" };
}

/**
 * @param {string} content
 * @returns {Record<string, string>[]}
 */
export function extractWorkflowPermissionsMaps(content) {
  const doc = parseYaml(content);
  if (!doc || typeof doc !== "object") {
    return [];
  }
  /** @type {Record<string, string>[]} */
  const maps = [];
  if ("permissions" in doc) {
    const map = normalizePermissionsValue(doc.permissions);
    if (map) {
      maps.push(map);
    }
  }
  const jobs = doc.jobs;
  if (jobs && typeof jobs === "object") {
    for (const job of Object.values(jobs)) {
      if (job && typeof job === "object" && "permissions" in job) {
        const map = normalizePermissionsValue(job.permissions);
        if (map) {
          maps.push(map);
        }
      }
    }
  }
  return maps;
}

/**
 * @param {Record<string, string>} map
 * @param {Record<string, string>} expected
 */
export function permissionsMapEquals(map, expected) {
  const keys = Object.keys(expected);
  if (Object.keys(map).length !== keys.length) {
    return false;
  }
  for (const key of keys) {
    if (map[key] !== expected[key]) {
      return false;
    }
  }
  return true;
}

/**
 * @param {string} workflowYaml
 * @param {Record<string, string>} expected
 */
export function workflowPermissionsAllowOnly(workflowYaml, expected) {
  const maps = extractWorkflowPermissionsMaps(workflowYaml);
  if (maps.length === 0) {
    return false;
  }
  return maps.every((map) => permissionsMapEquals(map, expected));
}
