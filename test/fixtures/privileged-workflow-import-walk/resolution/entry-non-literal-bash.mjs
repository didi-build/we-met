import { spawnSync } from "node:child_process";

spawnSync("bash", ["$MISSING_SCRIPT"]);

export const ran = true;
