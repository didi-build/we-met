import { createRequire } from "node:module";

createRequire(import.meta.url)("./cr-target.cjs");

export const loaded = true;
