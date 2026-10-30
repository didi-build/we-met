import { spawnSync } from "node:child_process";

spawnSync("npm", [
  "exec",
  "test/fixtures/privileged-workflow-import-walk/resolution/npm-exec-target.mjs",
]);

export const ran = true;
