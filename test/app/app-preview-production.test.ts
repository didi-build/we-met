import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("/app-preview route (unit)", () => {
  it("is removed (always notFound)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/app-preview/page.tsx"),
      "utf8",
    );
    expect(src).toContain("notFound()");
  });
});
