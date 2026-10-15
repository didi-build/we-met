import { serializeLeadSinkConfig } from "@/card-data/lead-sink-registry";
import type {
  CardsLoadFile,
  CardLoadInput,
  LeadSinkLoadInput,
} from "@/card-data/types";

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

  for (const card of loadFile.cards) {
    if (card.leadSinks !== undefined) {
      statements.push(...buildLeadSinkStatements(card, options.updatedAt));
    }
  }

  return `${statements.join(";\n")};\n`;
}

function buildLeadSinkStatements(card: CardLoadInput, updatedAt: string): string[] {
  const sinks = card.leadSinks ?? [];
  const slugLiteral = escapeSqlStringLiteral(card.slug);
  const statements: string[] = [];

  for (const sink of sinks) {
    statements.push(buildLeadSinkUpsertStatement(card.slug, sink, updatedAt));
  }

  if (sinks.length === 0) {
    statements.push(
      `DELETE FROM lead_sinks WHERE card_id = (SELECT id FROM cards WHERE slug = ${slugLiteral})`,
    );
  } else {
    const idLiterals = sinks.map((s) => escapeSqlStringLiteral(s.id)).join(", ");
    statements.push(
      `DELETE FROM lead_sinks WHERE card_id = (SELECT id FROM cards WHERE slug = ${slugLiteral}) AND id NOT IN (${idLiterals})`,
    );
  }

  return statements;
}

function buildLeadSinkUpsertStatement(
  slug: string,
  sink: LeadSinkLoadInput,
  updatedAt: string,
): string {
  const configJson = escapeSqlStringLiteral(
    serializeLeadSinkConfig(sink.kind, sink.config),
  );
  const enabled = sink.enabled ? 1 : 0;
  const slugLiteral = escapeSqlStringLiteral(slug);
  return `INSERT INTO lead_sinks (id, card_id, kind, config_json, enabled, created_at, updated_at)
SELECT
  ${escapeSqlStringLiteral(sink.id)},
  c.id,
  ${escapeSqlStringLiteral(sink.kind)},
  ${configJson},
  ${enabled},
  ${escapeSqlStringLiteral(updatedAt)},
  ${escapeSqlStringLiteral(updatedAt)}
FROM cards c WHERE c.slug = ${slugLiteral}
ON CONFLICT(id) DO UPDATE SET
  card_id = excluded.card_id,
  kind = excluded.kind,
  config_json = excluded.config_json,
  enabled = excluded.enabled,
  updated_at = excluded.updated_at`;
}

function buildCardUpsertStatement(
  card: CardLoadInput,
  newId: string,
  updatedAt: string,
): string {
  const linksJson = cardJson(card.links);
  const pageCopyJson = cardJson(card.pageCopy);
  const contactJson = cardJson(card.contact);
  const copyJson = cardJson(card.copy);

  return `INSERT INTO cards (
  id, slug, variant, display_name, email, photo_key,
  links_json, page_copy_json, contact_json, copy_json, updated_at
) VALUES (
  ${escapeSqlStringLiteral(newId)},
  ${escapeSqlStringLiteral(card.slug)},
  ${escapeSqlStringLiteral(card.variant)},
  ${escapeSqlStringLiteral(card.displayName)},
  ${escapeSqlStringLiteral(card.email)},
  ${sqlNullableString(card.photoKey)},
  ${linksJson},
  ${pageCopyJson},
  ${contactJson},
  ${copyJson},
  ${escapeSqlStringLiteral(updatedAt)}
)
ON CONFLICT(slug) DO UPDATE SET
  variant = excluded.variant,
  display_name = excluded.display_name,
  email = excluded.email,
  photo_key = excluded.photo_key,
  links_json = excluded.links_json,
  page_copy_json = excluded.page_copy_json,
  contact_json = excluded.contact_json,
  copy_json = excluded.copy_json,
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
