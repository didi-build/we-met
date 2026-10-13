/**
 * @param {{
 *   prState: string;
 *   prHeadSha: string;
 *   manifestHeadSha: string;
 * }} input
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function validateApplyPrHead({ prState, prHeadSha, manifestHeadSha }) {
  if (prState !== "open") {
    return { ok: false, reason: `PR is not open (state: ${prState})` };
  }
  if (prHeadSha !== manifestHeadSha) {
    return {
      ok: false,
      reason: `PR head SHA changed (manifest ${manifestHeadSha}, current ${prHeadSha})`,
    };
  }
  return { ok: true };
}

/**
 * When apply cannot run because the PR moved, do not rewrite the PR comment.
 *
 * @param {{ ok: true } | { ok: false; reason: string }} headCheck
 * @returns {{ proceed: true } | { proceed: false; updatePrComment: false; reason: string; exitCode: number }}
 */
export function resolveApplyHeadCheck(headCheck) {
  if (headCheck.ok) {
    return { proceed: true };
  }
  return {
    proceed: false,
    updatePrComment: false,
    reason: headCheck.reason,
    exitCode: 1,
  };
}
