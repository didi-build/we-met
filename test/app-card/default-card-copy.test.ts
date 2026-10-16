import { DEFAULT_MVP_CARD_COPY } from "@/app-card/default-card-copy";
import { describe, expect, it } from "vitest";

describe("default MVP card copy (unit)", () => {
  it("uses We Met support email for exchange failures", () => {
    expect(DEFAULT_MVP_CARD_COPY.exchangeSheet.exchangeNotSavedEmail).toBe(
      "hello@we-met.link",
    );
    expect(DEFAULT_MVP_CARD_COPY.exchangeSheet.exchangeNotSavedEmail).not.toContain(
      "didi.build",
    );
  });
});
