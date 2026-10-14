/**
 * Pick baseline commit SHA from production deployment history (newest successful).
 *
 * @typedef {{ id: number; sha: string; created_at?: string }} DeploymentRow
 */

/**
 * @param {string | undefined | null} state
 * @returns {boolean}
 */
export function isSuccessfulDeploymentStatus(state) {
  return state === "success";
}

/**
 * Deployments must be ordered newest-first (API default when sorted by created_at desc).
 *
 * @param {DeploymentRow[]} deploymentsNewestFirst
 * @param {(deploymentId: number) => string | null | undefined} latestStatusForDeployment
 * @returns {string | null} baseline SHA or null when no successful deployment exists
 */
export function pickBaselineShaFromDeployments(
  deploymentsNewestFirst,
  latestStatusForDeployment,
) {
  for (const deployment of deploymentsNewestFirst) {
    const latest = latestStatusForDeployment(deployment.id);
    if (isSuccessfulDeploymentStatus(latest?.toLowerCase?.() ?? latest)) {
      return deployment.sha;
    }
  }
  return null;
}
