import { spawnSync } from "node:child_process";

const c = true;
spawnSync("node", [
  c
    ? "test/fixtures/privileged-workflow-import-walk/resolution/spawn-cond-a.mjs"
    : "test/fixtures/privileged-workflow-import-walk/resolution/spawn-cond-b.mjs",
]);

export { c };
