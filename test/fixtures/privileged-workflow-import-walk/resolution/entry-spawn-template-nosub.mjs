import { spawnSync } from "node:child_process";

spawnSync("node", [
  `test/fixtures/privileged-workflow-import-walk/resolution/template-spawn-target.mjs`,
]);

export const ran = true;
