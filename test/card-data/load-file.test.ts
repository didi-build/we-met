import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCardsLoadFile } from "@/card-data/load-file";

describe("parseCardsLoadFile (unit)", () => {
  it("parses the committed example file", () => {
    const raw = JSON.parse(readFileSync("data/cards.example.json", "utf8"));
    const file = parseCardsLoadFile(raw);
    expect(file.cards).toHaveLength(1);
    expect(file.cards[0].slug).toBe("demo");
  });

  it("rejects leadSinks in step 1", () => {
    expect(() =>
      parseCardsLoadFile({
        cards: [],
        hostnames: [],
        leadSinks: [],
      }),
    ).toThrow(/step 1/);
  });
});
