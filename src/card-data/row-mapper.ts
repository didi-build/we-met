import type {
  BrandVariant,
  CardContact,
  CardExchangeCopy,
  CardPageCopy,
  CardRecord,
  FooterLink,
} from "@/card-data/types";

export type CardsRow = {
  id: string;
  slug: string;
  variant: string;
  display_name: string;
  email: string;
  photo_key: string | null;
  footer_link_json: string;
  page_copy_json: string;
  contact_json: string;
  exchange_copy_json: string;
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
  return {
    id: row.id,
    slug: row.slug,
    variant: row.variant as BrandVariant,
    displayName: row.display_name,
    email: row.email,
    photoKey: row.photo_key,
    footerLink: parseJson<FooterLink>("footer_link", row.footer_link_json),
    pageCopy: parseJson<CardPageCopy>("page_copy", row.page_copy_json),
    contact: parseJson<CardContact>("contact", row.contact_json),
    exchangeCopy: parseJson<CardExchangeCopy>("exchange_copy", row.exchange_copy_json),
    updatedAt: row.updated_at,
  };
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
