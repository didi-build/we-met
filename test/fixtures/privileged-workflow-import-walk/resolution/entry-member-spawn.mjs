import * as cp from "node:child_process";

cp.spawnSync("node", [
  "test/fixtures/privileged-workflow-import-walk/resolution/member-spawn-target.mjs",
]);

export const ran = true;
