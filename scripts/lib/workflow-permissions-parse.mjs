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
        return null;
      }
      map[String(key).toLowerCase()] = String(value).toLowerCase().trim();
    }
    if (Object.keys(map).length === 0) {
      return null;
    }
    return map;
  }
  return null;
}

/**
 * @param {unknown} doc
 * @returns {Record<string, string>[] | null}
 */
function collectJobPermissionMaps(doc) {
  /** @type {Record<string, string>[]} */
  const maps = [];
  const jobs = doc.jobs;
  if (!jobs || typeof jobs !== "object") {
    return maps;
  }
  for (const job of Object.values(jobs)) {
    if (job && typeof job === "object" && "permissions" in job) {
      const map = normalizePermissionsValue(job.permissions);
      if (!map) {
        return null;
      }
      maps.push(map);
    }
  }
  return maps;
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
  if (!("permissions" in doc)) {
    return [];
  }
  const workflowMap = normalizePermissionsValue(doc.permissions);
  if (!workflowMap) {
    return [];
  }
  const jobMaps = collectJobPermissionMaps(doc);
  if (jobMaps === null) {
    return [];
  }
  return [workflowMap, ...jobMaps];
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
 * @param {unknown} doc
 * @param {Record<string, string>} expected
 */
function workflowPermissionsDocumentAllowOnly(doc, expected) {
  if (!doc || typeof doc !== "object") {
    return false;
  }
  if (!("permissions" in doc)) {
    return false;
  }
  const workflowMap = normalizePermissionsValue(doc.permissions);
  if (!workflowMap || !permissionsMapEquals(workflowMap, expected)) {
    return false;
  }
  const jobs = doc.jobs;
  if (jobs && typeof jobs === "object") {
    for (const job of Object.values(jobs)) {
      if (job && typeof job === "object" && "permissions" in job) {
        const jobMap = normalizePermissionsValue(job.permissions);
        if (!jobMap || !permissionsMapEquals(jobMap, expected)) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * @param {string} workflowYaml
 * @param {Record<string, string>} expected
 */
export function workflowPermissionsAllowOnly(workflowYaml, expected) {
  const doc = parseYaml(workflowYaml);
  return workflowPermissionsDocumentAllowOnly(doc, expected);
}
