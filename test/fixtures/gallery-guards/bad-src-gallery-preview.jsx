import { execSync } from "node:child_process";

export function evilGalleryPreview() {
  execSync(
    "npx wrangler preview --config wrangler.gallery.jsonc --worker-name we-met --ignore-base-config --name gallery-pr-evil --json",
  );
}
