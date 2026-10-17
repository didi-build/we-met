import { describe, expect, it } from "vitest";
import type { ContactName } from "@/card-data/types";
import { ownerEmailDisplayName } from "@/email/owner-email-display-name";

function name(
  overrides: Partial<ContactName> & Pick<ContactName, "given">,
): ContactName {
  return {
    full: overrides.full ?? `${overrides.given} ${overrides.family ?? ""}`.trim(),
    family: overrides.family ?? "",
    given: overrides.given,
    nickname: overrides.nickname ?? "",
  };
}

describe("ownerEmailDisplayName (unit)", () => {
  it("formats signature names per visitor-email rules", () => {
    expect(
      ownerEmailDisplayName(
        name({ given: "Diadem", family: "Shoukralla", nickname: "Didi" }),
      ),
    ).toBe("Diadem (Didi) Shoukralla");

    expect(ownerEmailDisplayName(name({ given: "Diadem", family: "Shoukralla" }))).toBe(
      "Diadem Shoukralla",
    );

    expect(
      ownerEmailDisplayName(
        name({ given: "Diadem", family: "Shoukralla", nickname: "diadem" }),
      ),
    ).toBe("Diadem Shoukralla");

    expect(
      ownerEmailDisplayName(name({ given: "Zoë", family: "Müller", nickname: "ZM" })),
    ).toBe("Zoë (ZM) Müller");

    expect(ownerEmailDisplayName(name({ given: "Prince", family: "" }))).toBe("Prince");

    expect(
      ownerEmailDisplayName(name({ given: "R2D2", family: "Bot", full: "R2D2 Bot" })),
    ).toBe("R2D2 Bot");
  });

  it("trims and collapses whitespace", () => {
    expect(
      ownerEmailDisplayName(
        name({
          given: "  Diadem  ",
          family: "  Shoukralla ",
          nickname: " Didi ",
        }),
      ),
    ).toBe("Diadem (Didi) Shoukralla");
  });
});
