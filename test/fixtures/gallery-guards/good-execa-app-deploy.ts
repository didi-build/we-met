declare function execaSync(
  command: string,
  args: string[],
  options?: { stdio: "inherit" },
): unknown;

const deployArgs = ["wrangler", "deploy", "--config", "wrangler.jsonc"];

export function deployMainWorker(): void {
  execaSync("npx", deployArgs, { stdio: "inherit" });
}
