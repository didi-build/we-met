/**
 * Preview must not provision. Fail early when a PR declares non-prod D1/R2
 * names that are not on main yet (resource is created after merge).
 */

import { collectDeclaredResources } from "./provision-resources.mjs";

export const PROVISION_NONPROD_MAIN_WORKFLOW = "Provision non-prod resources (main)";

/**
 * @param {{ d1: string[], r2: string[] }} onMain
 * @param {{ d1: string[], r2: string[] }} onPr
 */
export function findNonprodResourcesNotOnMain(onMain, onPr) {
  const mainD1 = new Set(onMain.d1);
  const mainR2 = new Set(onMain.r2);
  /** @type {{ kind: 'd1' | 'r2', name: string }[]} */
  const missing = [];
  for (const name of onPr.d1) {
    if (!mainD1.has(name)) {
      missing.push({ kind: "d1", name });
    }
  }
  for (const name of onPr.r2) {
    if (!mainR2.has(name)) {
      missing.push({ kind: "r2", name });
    }
  }
  missing.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return missing;
}

/**
 * @param {Record<string, unknown>} mainWrangler
 * @param {Record<string, unknown> | null} mainConsumer
 * @param {Record<string, unknown>} prWrangler
 * @param {Record<string, unknown> | null} prConsumer
 */
export function findPreviewBlockedResources(
  mainWrangler,
  mainConsumer,
  prWrangler,
  prConsumer,
) {
  const onMain = collectDeclaredResources(mainWrangler, mainConsumer, "nonprod");
  const onPr = collectDeclaredResources(prWrangler, prConsumer, "nonprod");
  return findNonprodResourcesNotOnMain(onMain, onPr);
}

/**
 * @param {{ kind: 'd1' | 'r2', name: string }[]} missing
 */
export function formatPreviewMissingResourceMessage(missing) {
  const lines = missing.map((entry) => {
    const label = entry.kind === "d1" ? "D1 database" : "R2 bucket";
    return (
      `Non-prod ${label} "${entry.name}" does not exist yet. ` +
      `Preview does not provision. After this PR merges to main, the "${PROVISION_NONPROD_MAIN_WORKFLOW}" ` +
      `workflow (push to main on wrangler config paths, or workflow_dispatch) creates missing non-prod ` +
      `D1/R2 from main; re-run Preview or open a follow-up PR once that job has succeeded.`
    );
  });
  return lines.join("\n");
}
