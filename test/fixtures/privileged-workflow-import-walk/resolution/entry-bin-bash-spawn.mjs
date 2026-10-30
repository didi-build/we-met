import { spawnSync } from "node:child_process";

spawnSync("/bin/bash", [
  "test/fixtures/privileged-workflow-import-walk/resolution/bin-bash-target.sh",
]);

export const ran = true;
