import { appendFileSync, writeFileSync } from "node:fs";
import {
  buildProvisionPlan,
  executeProvisionPlan,
  formatProvisionD1IdsFile,
  lookupDeclaredD1,
  lookupDeclaredR2,
  maskResolvedD1Ids,
  validateD1IdsAgainstEnv,
} from "./provision-resources.mjs";

function maskId(id) {
  console.log(`::add-mask::${id}`);
}

function writeGithubOutput(outputPath) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) return;
  appendFileSync(githubOutput, `provision_d1_ids_file=${outputPath}\n`, "utf8");
}

/**
 * @param {object} params
 * @param {import('./provision-resources.mjs').ProvisionTarget} params.target
 * @param {string[]} params.d1
 * @param {string[]} params.r2
 * @param {import('./cloudflare-provision-api.mjs').CloudflareApiClient} params.api
 * @param {Record<string, string | undefined>} params.env
 * @param {string} params.outputPath
 */
export async function runProvisionForDeclared({
  target,
  d1,
  r2,
  api,
  env,
  outputPath,
}) {
  const existingD1 = d1.length > 0 ? await lookupDeclaredD1(d1, api) : [];
  const existingR2 = r2.length > 0 ? await lookupDeclaredR2(r2, api) : [];
  const plan = buildProvisionPlan(d1, r2, existingD1, existingR2);
  const { log, resolvedD1Ids } = await executeProvisionPlan(plan, api, existingD1);

  for (const entry of log) {
    console.log(`provision: ${entry.message}`);
  }

  maskResolvedD1Ids(resolvedD1Ids, maskId);

  const envErrors = validateD1IdsAgainstEnv(resolvedD1Ids, target, env);
  if (Object.keys(resolvedD1Ids).length > 0) {
    writeFileSync(outputPath, formatProvisionD1IdsFile(resolvedD1Ids), "utf8");
    writeGithubOutput(outputPath);
  }

  return { envErrors, resolvedD1Ids };
}

export function provisionLogLinesWithoutMasks(lines) {
  return lines.filter((line) => !line.startsWith("::add-mask::"));
}
