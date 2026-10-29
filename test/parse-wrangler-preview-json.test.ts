import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/parse-wrangler-preview-json.mjs";

describe("parse-wrangler-preview-json (unit)", () => {
  it("extracts URL when wrangler logs precede JSON", () => {
    const input = ` ⛅️ wrangler 4.149.0
────────────────────
{"preview":{"urls":["https://pr-3-we-met-preview.example.workers.dev"]}}
`;
    const result = spawnSync("node", [SCRIPT], {
      input,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      "https://pr-3-we-met-preview.example.workers.dev",
    );
  });

  it("fails when JSON has no preview URL", () => {
    const result = spawnSync("node", [SCRIPT], {
      input: '{"preview":{"urls":[]}}',
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
  });
});
