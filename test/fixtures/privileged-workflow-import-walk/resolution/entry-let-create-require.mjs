import { createRequire } from "node:module";

let req = createRequire(import.meta.url);
req("./let-cr-target.cjs");

export const loaded = true;
