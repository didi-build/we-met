import { spawnSync } from "node:child_process";

spawnSync("/usr/bin/bash", [
  "test/fixtures/privileged-workflow-import-walk/resolution/usr-bin-target.sh",
]);

export const ran = true;
