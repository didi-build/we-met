const PR_NUMBER_RE = /^\d+$/;

/**
 * @param {string | undefined} prNumber
 * @returns {{ ok: true; prNumber: string } | { ok: false; message: string }}
 */
export function validatePrNumber(prNumber) {
  const trimmed = prNumber?.trim() ?? "";
  if (!PR_NUMBER_RE.test(trimmed)) {
    return { ok: false, message: `Invalid PR_NUMBER "${prNumber ?? ""}"` };
  }
  return { ok: true, prNumber: trimmed };
}
