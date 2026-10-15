import { cardRowToRecord } from "@/card-data/card-persist";
import type { CardRecord } from "@/card-data/types";

export type CardsRow = {
  id: string;
  slug: string;
  variant: string;
  display_name: string;
  email: string;
  photo_key: string | null;
  links_json: string;
  page_copy_json: string;
  contact_json: string;
  copy_json: string;
  updated_at: string;
};

export type LeadSinksRow = {
  id: string;
  card_id: string;
  kind: string;
  config_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(label: string, raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Invalid ${label} JSON in database`);
  }
}

export function mapCardRow(row: CardsRow): CardRecord {
  return cardRowToRecord(row, parseJson);
}

export function mapLeadSinkRow(
  row: LeadSinksRow,
  config: unknown,
): import("@/card-data/types").LeadSinkRecord {
  return {
    id: row.id,
    cardId: row.card_id,
    kind: row.kind,
    config,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
