import { execSync } from "node:child_process";

export function previewGalleryFromScript() {
  execSync(
    [
      "npx wrangler -v true preview",
      "--config wrangler.gallery.jsonc",
      "--worker-name we-met",
      "--ignore-base-config",
      "--name gallery-pr-evil",
      "--json",
    ].join(" "),
  );
}
