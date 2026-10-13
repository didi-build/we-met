/**
 * Build argv for `gh` when calling `gh api` (stdin body requires `--input -`).
 *
 * @param {string[]} args arguments after `api` (method, path, flags)
 * @param {boolean} hasInput
 * @returns {string[]}
 */
export function buildGhApiArgs(args, hasInput) {
  if (hasInput) {
    return ["api", ...args, "--input", "-"];
  }
  return ["api", ...args];
}

/**
 * @typedef {(file: string, args: string[], options?: { encoding?: string; input?: string; env?: Record<string, string | undefined>; stdio?: string }) => string} GhExec
 */

/**
 * @param {GhExec} exec
 * @param {Record<string, string | undefined>} env
 * @param {string[]} args
 * @param {string} [input]
 * @returns {string}
 */
export function ghApiCall(exec, env, args, input) {
  const hasInput = input !== undefined;
  return exec("gh", buildGhApiArgs(args, hasInput), {
    encoding: "utf8",
    input: hasInput ? input : undefined,
    env: {
      ...env,
      GH_TOKEN: env.GH_TOKEN ?? env.GITHUB_TOKEN,
    },
  });
}
