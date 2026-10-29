import { execSync } from "node:child_process";

export function deployViaSplitTemplateConfig() {
  execSync(`npx wrangler deploy --config wrangler.gal\
lery.jsonc`);
}
