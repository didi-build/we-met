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
