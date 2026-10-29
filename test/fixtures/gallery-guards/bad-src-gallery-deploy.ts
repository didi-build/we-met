import { execSync } from "node:child_process";

/** Regression fixture: gallery deploy must not be triggered from app source. */
export function accidentalGalleryDeploy(): void {
  execSync("npx wrangler deploy --config wrangler.gallery.jsonc");
}
