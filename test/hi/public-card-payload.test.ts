import { describe, expect, it } from "vitest";
import { exampleCardRecord } from "../helpers/example-card";
import {
  assertNoPublicHiCardLeaks,
  PUBLIC_HI_CARD_PAYLOAD_KEYS,
  serializePublicHiCard,
} from "@/lib/hi-card/public-card-payload";

describe("serializePublicHiCard", () => {
  it("includes only rendered /hi fields", () => {
    const full = exampleCardRecord();
    const payload = serializePublicHiCard(full);

    expect(Object.keys(payload).sort()).toEqual(
      [...PUBLIC_HI_CARD_PAYLOAD_KEYS].sort(),
    );
    expect(payload.slug).toBe(full.slug);
    expect(payload.name).toBe(full.name);
    expect(payload.hasPhoto).toBe(Boolean(full.photoKey));
    expect(payload.pageCopy).toEqual({ headshotAlt: full.pageCopy.headshotAlt });
    expect(payload).not.toHaveProperty("accountId");
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("contact");
    expect(payload).not.toHaveProperty("photoKey");

    assertNoPublicHiCardLeaks(payload, full.email);
  });

  it("fails the leak guard when sensitive fields are injected", () => {
    const payload = serializePublicHiCard(exampleCardRecord());
    const poisoned = {
      ...payload,
      accountId: "leak",
    } as typeof payload & { accountId: string };

    expect(() => assertNoPublicHiCardLeaks(poisoned, "owner@example.com")).toThrow(
      /accountId/,
    );
  });
});
