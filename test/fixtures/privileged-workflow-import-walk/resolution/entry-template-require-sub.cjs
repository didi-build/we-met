/* eslint-disable @typescript-eslint/no-require-imports -- privileged walk fixture (N15 require sub) */
const part = "missing";
require(`./${part}.cjs`);

module.exports = { loaded: true };
