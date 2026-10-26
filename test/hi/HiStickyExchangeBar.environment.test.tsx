// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HiStickyExchangeBar } from "@/components/hi/HiStickyExchangeBar";

describe("HiStickyExchangeBar environment offset (unit)", () => {
  it("offsets the sticky bar below the environment banner CSS variable", () => {
    const { container } = render(
      <HiStickyExchangeBar
        visible
        name="Didi"
        initials="D"
        photoUrl={null}
        photoAlt=""
        onExchange={() => undefined}
      />,
    );
    const bar = container.firstElementChild;
    expect(bar?.className).toContain(
      "top-[var(--we-met-environment-banner-offset,0px)]",
    );
  });
});
