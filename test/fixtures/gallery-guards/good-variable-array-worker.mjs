import { spawnSync } from "node:child_process";

const args = ["wrangler", "deploy", "--config", "wrangler.jsonc"];

export function deployAppWorker() {
  spawnSync("npx", args, { stdio: "inherit" });
}
