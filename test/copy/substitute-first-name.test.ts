import { describe, expect, it } from "vitest";
import { substituteFirstName } from "@/lib/copy/substitute-first-name";

describe("substituteFirstName", () => {
  it("replaces the token without trimming padding", () => {
    expect(substituteFirstName(" prefix", "Ada")).toBe(" prefix");
    expect(substituteFirstName("Thanks, {firstName}.", "Ada")).toBe("Thanks, Ada.");
  });
});
