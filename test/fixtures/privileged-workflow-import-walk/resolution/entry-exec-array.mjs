import { execSync } from "node:child_process";

execSync("node", [
  "test/fixtures/privileged-workflow-import-walk/resolution/exec-array-target.mjs",
]);

export const ran = true;
