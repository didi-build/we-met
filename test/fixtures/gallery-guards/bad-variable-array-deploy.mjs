import { spawnSync } from "node:child_process";

const cfg = "wrangler.gallery.jsonc";

const wranglerArgs = ["wrangler", "deploy", "--config", cfg];

export function publishGalleryAssets() {
  spawnSync("npx", wranglerArgs, { stdio: "inherit" });
}
