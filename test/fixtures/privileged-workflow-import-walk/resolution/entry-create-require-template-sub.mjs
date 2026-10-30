import { createRequire } from "node:module";

const part = "missing";
createRequire(import.meta.url)(`./${part}.cjs`);

export const loaded = true;
