import { spawnSync } from "node:child_process";

spawnSync("bash", [
  `test/fixtures/privileged-workflow-import-walk/resolution/execsync-target.sh`,
]);

export const ran = true;
