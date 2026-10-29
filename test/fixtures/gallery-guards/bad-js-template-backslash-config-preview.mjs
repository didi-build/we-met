import { execSync } from "node:child_process";

export function previewViaSplitTemplateConfig() {
  execSync(`npx wrangler preview --config wrangler.gal\
lery.jsonc --worker-name we-met --ignore-base-config --name gallery-pr-evil --json`);
}
