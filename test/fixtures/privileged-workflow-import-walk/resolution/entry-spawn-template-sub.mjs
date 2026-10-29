import { spawnSync } from "node:child_process";

const x = "missing";
spawnSync("node", [`scripts/${x}.mjs`]);

export const ran = true;
