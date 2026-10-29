const manifest = { files: ["0001_a.sql"] };
const msg = `Applying ${manifest.files.map((f) => `\`${f}\``).join(", ")} to **we-met-db-nonprod**.\n`;
import "./after-apply-shape.mjs";
export { msg };
