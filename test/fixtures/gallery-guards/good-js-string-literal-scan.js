import { execSync } from "node:child_process";

export function runOtherPreview() {
  execSync(`npx wrangler preview --config wrangler.jsonc --name other-preview --json`);
}
