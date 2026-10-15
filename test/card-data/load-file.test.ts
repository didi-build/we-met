import { describe, expect, it } from "vitest";
import { parseCardsLoadFile } from "@/card-data/load-file";
import { exampleLoadRaw } from "../helpers/example-card";

describe("parseCardsLoadFile (unit)", () => {
  it("parses the committed example file", () => {
    const file = parseCardsLoadFile(exampleLoadRaw());
    expect(file.cards).toHaveLength(1);
    expect(file.cards[0].slug).toBe("didi");
  });
});
