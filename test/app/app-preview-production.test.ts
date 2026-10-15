import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/app-preview route (unit)", () => {
  it("returns notFound in production", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/app-preview/page.tsx"),
      "utf8",
    );
    expect(src).toContain('weMetEnv === "production"');
    expect(src).toContain("notFound()");
  });
});
