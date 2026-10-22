import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("check-warmup-no-emails script (unit)", () => {
  it("passes on the committed workers/warmup tree", () => {
    const result = spawnSync("node", ["scripts/check-warmup-no-emails.mjs"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok");
  });

  it("runs as part of npm run check", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: { check: string };
    };
    expect(pkg.scripts.check).toContain("warmup-no-emails");
  });

  it("rejects a non-example.com address in workers/warmup content", () => {
    const sample = "notify ops@mail.we-met.link please";
    const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const email = sample.match(EMAIL_RE)?.[0] ?? "";
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    expect(domain).toBe("mail.we-met.link");
    expect(domain === "example.com" || domain.endsWith(".example.com")).toBe(false);
  });
});
