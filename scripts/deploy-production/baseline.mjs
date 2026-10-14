/**
 * Pick baseline commit SHA from production deployment history (newest successful).
 *
 * @typedef {{ id: number; sha: string; created_at?: string }} DeploymentRow
 */

/**
 * UNVERIFIED: whether the GitHub deployments list API returns rows newest-first by default.
 *
 * @param {DeploymentRow[]} deployments
 * @returns {DeploymentRow[]}
 */
export function sortDeploymentsNewestFirst(deployments) {
  return [...deployments].sort((a, b) => {
    const timeA = a.created_at ? Date.parse(a.created_at) : 0;
    const timeB = b.created_at ? Date.parse(b.created_at) : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });
}

/**
 * @param {string | undefined | null} state
 * @returns {boolean}
 */
export function isSuccessfulDeploymentStatus(state) {
  return state === "success";
}

/**
 * Deployments must be ordered newest-first (use {@link sortDeploymentsNewestFirst}).
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
