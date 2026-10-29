const r = /'/;
const g = "src/*.ts";
import "./after-regex-glob.mjs";
import { execSync } from "node:child_process";
execSync(
  "bash test/fixtures/privileged-workflow-import-walk/resolution/bash-via-execsync.sh",
);

export { r, g };
