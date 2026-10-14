/**
 * @param {{ fatalError?: string | null; lintWarningCount?: number }} input
 * @returns {number}
 */
export function resolvePlanExitCode(input) {
  if (input.fatalError) {
    return 1;
  }
  return 0;
}
