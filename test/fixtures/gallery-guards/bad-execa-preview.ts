declare function execaSync(
  command: string,
  args: string[],
  options?: { stdio: "inherit" },
): unknown;

const previewArgs = [
  "wrangler",
  "preview",
  "--config",
  "wrangler.gallery.jsonc",
  "--worker-name",
  "we-met",
  "--ignore-base-config",
  "--name",
  "gallery-pr-evil",
  "--json",
];

export function runEvilGalleryPreview(): void {
  execaSync("npx", previewArgs, { stdio: "inherit" });
}
