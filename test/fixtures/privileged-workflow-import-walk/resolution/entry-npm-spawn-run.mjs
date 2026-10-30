import { spawnSync } from "node:child_process";

spawnSync("npm", ["run", "walk-fixture-n11"]);

export const ran = true;
