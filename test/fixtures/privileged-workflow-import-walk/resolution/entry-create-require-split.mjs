import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
req("./require-split-target.mjs");

export const ran = true;
