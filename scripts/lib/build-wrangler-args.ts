import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export const D1_READ_BACK_SQL = "SELECT slug, updated_at FROM cards ORDER BY slug";

export function resolveWranglerEntry(): string {
  const packageJson = require.resolve("wrangler/package.json");
  return join(dirname(packageJson), "bin/wrangler.js");
}

export type BuildWranglerArgsInput =
  | {
      kind: "execute-file";
      configRel: string | null;
      remote: boolean;
      sqlRel: string;
    }
  | {
      kind: "read-back";
      configRel: string | null;
    };

/**
 * argv for spawnSync(process.execPath, buildWranglerArgs(...)) — no shell.
 */
export function buildWranglerArgs(input: BuildWranglerArgsInput): string[] {
  const wranglerEntry = resolveWranglerEntry();
  const configFlag = input.configRel ? ["-c", input.configRel] : [];

  if (input.kind === "execute-file") {
    const wranglerTarget = input.remote ? "--remote" : "--local";
    return [
      wranglerEntry,
      ...configFlag,
      "d1",
      "execute",
      "WE_MET_DB",
      wranglerTarget,
      "--file",
      input.sqlRel,
    ];
  }

  return [
    wranglerEntry,
    ...configFlag,
    "d1",
    "execute",
    "WE_MET_DB",
    "--remote",
    "--command",
    D1_READ_BACK_SQL,
  ];
}
