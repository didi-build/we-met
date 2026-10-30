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
    expect(result.stderr).toContain("preview.urls: []");
    expect(result.stderr).toContain("missing preview.urls[0]");
  });

  it("does not print Cloudflare author_id when preview URL is missing", () => {
    const authorId = "00000000-0000-0000-0000-authorid00001";
    const input = `{"preview":{"urls":[]},"author_id":"${authorId}"}`;
    const result = spawnSync("node", [SCRIPT], {
      input,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview.urls: []");
    expect(result.stderr).not.toContain(authorId);
  });

  it("does not print Cloudflare author_id when JSON is malformed", () => {
    const authorId = "00000000-0000-0000-0000-authorid00001";
    const input = `{"preview":{"urls":["https://example.workers.dev"]},"author_id":"${authorId}"`;
    const result = spawnSync("node", [SCRIPT], {
      input,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("parse-wrangler-preview-json: invalid JSON\n");
    expect(result.stderr).not.toContain(authorId);
  });

  it("does not print nested preview author_id when preview URL is missing", () => {
    const authorId = "00000000-0000-0000-0000-authorid00002";
    const input = `{"preview":{"urls":[],"author_id":"${authorId}"}}`;
    const result = spawnSync("node", [SCRIPT], {
      input,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preview.urls: []");
    expect(result.stderr).not.toContain(authorId);
  });
});
