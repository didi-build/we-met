import { spawnSync } from "node:child_process";

export function runSpawnViaLib() {
  spawnSync(process.execPath, [
    "test/fixtures/privileged-workflow-import-walk/resolution/spawned-target.mjs",
  ]);
}
