/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isComparePage(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} parsed
 * @returns {Record<string, unknown>[]}
 */
export function collectComparePages(parsed) {
  if (isComparePage(parsed)) {
    return [parsed];
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
  if (parsed.every((item) => isComparePage(item))) {
    return parsed;
  }
  if (parsed.every((item) => Array.isArray(item))) {
    return parsed.flat().filter(isComparePage);
  }
  return parsed.filter(isComparePage);
}

/**
 * Merge paginated `gh api --paginate --slurp` compare responses.
 *
 * @param {unknown} parsed
 * @returns {{
 *   status?: string;
 *   ahead_by?: number;
 *   behind_by?: number;
 *   files: unknown[];
 *   totalFileCount: number;
 * } | null}
 */
export function mergeCompareApiPages(parsed) {
  const pages = collectComparePages(parsed);
  if (pages.length === 0) {
    return null;
  }

  const first = pages[0];
  /** @type {unknown[]} */
  const files = [];
  for (const page of pages) {
    if (Array.isArray(page.files)) {
      files.push(...page.files);
    }
  }

  return {
    status: typeof first.status === "string" ? first.status : undefined,
    ahead_by: typeof first.ahead_by === "number" ? first.ahead_by : undefined,
    behind_by: typeof first.behind_by === "number" ? first.behind_by : undefined,
    files,
    totalFileCount: files.length,
  };
}
