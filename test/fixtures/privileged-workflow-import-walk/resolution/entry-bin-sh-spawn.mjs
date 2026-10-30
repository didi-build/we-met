import { spawnSync } from "node:child_process";

spawnSync("/bin/sh", [
  "test/fixtures/privileged-workflow-import-walk/resolution/bin-sh-target.sh",
]);

export const ran = true;
