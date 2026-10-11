import { readFileSync } from "node:fs";
import { parseCardsLoadFile } from "@/card-data/load-file";
import type { CardLoadInput, CardsLoadFile } from "@/card-data/types";

export function exampleLoadRaw(): unknown {
  return JSON.parse(readFileSync("data/cards.example.json", "utf8"));
}

export function exampleLoadFile(): CardsLoadFile {
  return parseCardsLoadFile(exampleLoadRaw());
}

export function exampleCardInput(): CardLoadInput {
  return exampleLoadFile().cards[0];
}
