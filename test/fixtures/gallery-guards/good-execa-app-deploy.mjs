import { execFileSync } from "node:child_process";

const deployArgs = ["wrangler", "deploy", "--config", "wrangler.jsonc"];

export function deployMainWorker() {
  execFileSync("npx", deployArgs, { stdio: "inherit" });
}
