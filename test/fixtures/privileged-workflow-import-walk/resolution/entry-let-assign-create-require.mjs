import { createRequire } from "node:module";

let req;
req = createRequire(import.meta.url);
req("./let-assign-cr-target.cjs");

export const loaded = true;
