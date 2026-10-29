import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = require("./require-target.cjs");

export { target };
