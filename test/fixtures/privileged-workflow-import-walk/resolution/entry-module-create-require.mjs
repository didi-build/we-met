import * as module from "node:module";

module.createRequire(import.meta.url)("./module-cr-target.cjs");

export const loaded = true;
