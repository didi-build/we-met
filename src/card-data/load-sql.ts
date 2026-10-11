import type { CardsLoadFile, CardLoadInput } from "@/card-data/types";

/** Max lengths for load-file string fields (see load-file.ts). */
export const LOAD_STRING_LIMITS = {
  displayName: 200,
  email: 254,
  photoKey: 256,
  footerLabel: 120,
  footerUrl: 2048,
  pageCopyField: 500,
  contactField: 500,
  contactEmail: 254,
  contactPhone: 64,
  exchangeCopyKey: 80,
  exchangeCopyValue: 2000,
} as const;

const CONTROL_OR_NUL = /[\u0000-\u001F\u007F]/;

export function assertNoControlCharacters(value: string, field: string): void {
  if (CONTROL_OR_NUL.test(value)) {
    throw new Error(`Control characters are not allowed in ${field}`);
  }
}

export function escapeSqlStringLiteral(value: string): string {
  assertNoControlCharacters(value, "SQL literal");
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableString(value: string | null): string {
  if (value === null) {
    return "NULL";
  }
  return escapeSqlStringLiteral(value);
}

function cardJson(value: unknown): string {
  const json = JSON.stringify(value);
  assertNoControlCharacters(json, "JSON column");
  return escapeSqlStringLiteral(json);
}

export type BuildLoadSqlOptions = {
  updatedAt: string;
  newCardIds: Map<string, string>;
};

export function buildCardsLoadSql(
  loadFile: CardsLoadFile,
  options: BuildLoadSqlOptions,
): string {
  const statements: string[] = [];

  for (const card of loadFile.cards) {
    const id = options.newCardIds.get(card.slug);
    if (!id) {
      throw new Error(`Missing generated id for slug: ${card.slug}`);
    }
    statements.push(buildCardUpsertStatement(card, id, options.updatedAt));
  }

  for (const mapping of loadFile.hostnames) {
    statements.push(buildHostnameUpsertStatement(mapping));
  }

  return `${statements.join(";\n")};\n`;
}

function buildCardUpsertStatement(
  card: CardLoadInput,
  newId: string,
  updatedAt: string,
): string {
  const footerLinkJson = cardJson(card.footerLink);
  const pageCopyJson = cardJson(card.pageCopy);
  const contactJson = cardJson(card.contact);
  const exchangeCopyJson = cardJson(card.exchangeCopy);

  return `INSERT INTO cards (
  id, slug, variant, display_name, email, photo_key,
  footer_link_json, page_copy_json, contact_json, exchange_copy_json, updated_at
) VALUES (
  ${escapeSqlStringLiteral(newId)},
  ${escapeSqlStringLiteral(card.slug)},
  ${escapeSqlStringLiteral(card.variant)},
  ${escapeSqlStringLiteral(card.displayName)},
  ${escapeSqlStringLiteral(card.email)},
  ${sqlNullableString(card.photoKey)},
  ${footerLinkJson},
  ${pageCopyJson},
  ${contactJson},
  ${exchangeCopyJson},
  ${escapeSqlStringLiteral(updatedAt)}
)
ON CONFLICT(slug) DO UPDATE SET
  variant = excluded.variant,
  display_name = excluded.display_name,
  email = excluded.email,
  photo_key = excluded.photo_key,
  footer_link_json = excluded.footer_link_json,
  page_copy_json = excluded.page_copy_json,
  contact_json = excluded.contact_json,
  exchange_copy_json = excluded.exchange_copy_json,
  updated_at = excluded.updated_at`;
}

function buildHostnameUpsertStatement(mapping: {
  hostname: string;
  slug: string;
}): string {
  const hostname = escapeSqlStringLiteral(mapping.hostname.toLowerCase());
  const slug = escapeSqlStringLiteral(mapping.slug);
  return `INSERT INTO hostnames (hostname, card_id)
SELECT ${hostname}, id FROM cards WHERE slug = ${slug}
ON CONFLICT(hostname) DO UPDATE SET card_id = excluded.card_id`;
}

export function newCardIdsForLoad(loadFile: CardsLoadFile): Map<string, string> {
  const ids = new Map<string, string>();
  for (const card of loadFile.cards) {
    ids.set(card.slug, crypto.randomUUID());
  }
  return ids;
}
