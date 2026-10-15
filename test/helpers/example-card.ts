import { readFileSync } from "node:fs";
import { parseCardsLoadFile } from "@/card-data/load-file";
import { registerBuiltInLeadSinkKinds } from "@/card-data/register-lead-sink-kinds";
import type { CardLoadInput, CardRecord, CardsLoadFile } from "@/card-data/types";

export function exampleLoadRaw(): unknown {
  return JSON.parse(readFileSync("data/cards.example.json", "utf8"));
}

export function exampleLoadFile(): CardsLoadFile {
  registerBuiltInLeadSinkKinds();
  return parseCardsLoadFile(exampleLoadRaw());
}

export function exampleCardInput(): CardLoadInput {
  return exampleLoadFile().cards[0];
}

export function exampleCardRecord(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: "test-id",
    accountId: "test-account-id",
    status: "live",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...exampleCardInput(),
    ...overrides,
  };
}
