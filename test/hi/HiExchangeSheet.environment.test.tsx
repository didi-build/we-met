// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HiExchangeSheet } from "@/components/hi/HiExchangeSheet";
import { exampleCardInput } from "../helpers/example-card";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

vi.mock("@/components/hi/hi-sheet-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-sheet-motion")>();
  return {
    ...mod,
    prefersReducedMotion: () => true,
    runSheetCloseAnimation: ({ onComplete }: { onComplete: () => void }) => {
      onComplete();
      return () => {};
    },
  };
});

describe("HiExchangeSheet environment offset (unit)", () => {
  it("offsets the sheet overlay below the environment banner CSS variable", () => {
    const { container } = render(
      <HiExchangeSheet
        slug="demo"
        copy={exampleCardInput().copy.exchangeSheet}
        open
        onClose={() => undefined}
      />,
    );
    const overlay = container.firstElementChild;
    expect(overlay?.className).toContain(
      "top-[var(--we-met-environment-banner-offset,0px)]",
    );
  });
});
