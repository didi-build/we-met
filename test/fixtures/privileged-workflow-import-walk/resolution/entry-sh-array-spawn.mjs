import { spawnSync } from "node:child_process";

spawnSync("sh", [
  "test/fixtures/privileged-workflow-import-walk/resolution/spawn-helper.sh",
]);

export const ran = true;
