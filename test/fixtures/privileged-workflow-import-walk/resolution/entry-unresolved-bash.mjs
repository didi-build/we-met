import { spawnSync } from "node:child_process";

spawnSync("bash", [
  "test/fixtures/privileged-workflow-import-walk/resolution/missing-spawn.sh",
]);
