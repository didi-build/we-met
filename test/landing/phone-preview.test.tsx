// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PhonePreviewFallback } from "@/components/landing/PhonePreviewFallback";

describe("PhonePreviewFallback (unit)", () => {
  it("renders static fallback without iframe and is aria-hidden", () => {
    const { container } = render(<PhonePreviewFallback />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".lp-phone")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(container.querySelector(".lp-phone-screen")).toBeTruthy();
    expect(container.querySelector(".lp-fb-greet")?.textContent).toContain("Didi");
  });

  it("uses non-interactive phone screen (pointer-events none in CSS)", () => {
    const css = readFileSync("src/components/landing/landing.css", "utf8");
    expect(css).toMatch(/\.lp-phone-screen[\s\S]*?pointer-events:\s*none/);
    expect(css).not.toMatch(/\.lp-phone-content iframe/);
  });
});
