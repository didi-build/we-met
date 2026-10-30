import { exec } from "node:child_process";

exec("node", [
  "test/fixtures/privileged-workflow-import-walk/resolution/exec-fn-target.mjs",
]);

export const ran = true;
