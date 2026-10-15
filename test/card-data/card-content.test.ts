import { describe, expect, it } from "vitest";
import { normalizeBrandVariant } from "@/card-data/normalize-variant";
import {
  cardContentFlags,
  cardGreeting,
  cardInitials,
  WE_MET_CARD_HOME_URL,
} from "@/lib/hi-card/card-content";
import { exampleCardInput } from "../helpers/example-card";
import type { CardRecord } from "@/card-data/types";

function minimalCard(overrides: Partial<CardRecord> = {}): CardRecord {
  const input = exampleCardInput();
  return {
    id: "id",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
    ...overrides,
  };
}

describe("card content helpers (unit)", () => {
  it("computes initials and greeting", () => {
    expect(cardInitials("Didi Shoukralla")).toBe("DS");
    expect(cardGreeting("Didi Shoukralla")).toBe("I'm Didi");
  });

  it("normalizes unknown variant to mono", () => {
    expect(normalizeBrandVariant("blue")).toBe("blue");
    expect(normalizeBrandVariant("nope")).toBe("mono");
  });

  it("flags optional sections from example card", () => {
    const flags = cardContentFlags(minimalCard());
    expect(flags.hasAbout).toBe(true);
    expect(flags.hasServices).toBe(true);
    expect(flags.hasSocialLinks).toBe(true);
    expect(flags.hasFallback).toBe(true);
  });

  it("hides sections when data is missing", () => {
    const flags = cardContentFlags(
      minimalCard({
        about: undefined,
        aboutTitle: undefined,
        services: [],
        publicLinks: [],
        fallbackUrl: undefined,
        fallbackLabel: undefined,
        photoKey: null,
      }),
    );
    expect(flags.hasAbout).toBe(false);
    expect(flags.hasServices).toBe(false);
    expect(flags.hasLinks).toBe(false);
    expect(flags.hasPhoto).toBe(false);
    expect(flags.hasFallback).toBe(false);
  });

  it("uses the We Met marketing URL", () => {
    expect(WE_MET_CARD_HOME_URL).toBe("https://we-met.link");
  });
});
