import {
  parseLeadSinkConfig,
  serializeLeadSinkConfig,
} from "@/card-data/lead-sink-registry";
import type { LeadSinkUpsertInput, CardRepository } from "@/card-data/repository";
import {
  mapCardRow,
  mapLeadSinkRow,
  type CardsRow,
  type LeadSinksRow,
} from "@/card-data/row-mapper";
import { registerBuiltInLeadSinkKinds } from "@/card-data/register-lead-sink-kinds";
import { cardLoadInputToPersisted } from "@/card-data/card-persist";
import type {
  CardLoadInput,
  CardRecord,
  HostnameMapping,
  LeadSinkRecord,
} from "@/card-data/types";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

export class D1CardRepository implements CardRepository {
  constructor(private readonly db: D1Database) {
    registerBuiltInLeadSinkKinds();
  }

  async getBySlug(slug: string): Promise<CardRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, slug, variant, display_name, email, photo_key,
                links_json, page_copy_json, contact_json, copy_json, updated_at
         FROM cards WHERE slug = ?`,
      )
      .bind(slug)
      .first<CardsRow>();
    return row ? mapCardRow(row) : null;
  }

  async getByHostname(hostname: string): Promise<CardRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT c.id, c.slug, c.variant, c.display_name, c.email, c.photo_key,
                c.links_json, c.page_copy_json, c.contact_json, c.copy_json, c.updated_at
         FROM hostnames h
         JOIN cards c ON c.id = h.card_id
         WHERE h.hostname = ?`,
      )
      .bind(hostname.toLowerCase())
      .first<CardsRow>();
    return row ? mapCardRow(row) : null;
  }

  async upsertCard(input: CardLoadInput): Promise<CardRecord> {
    const existing = await this.getBySlug(input.slug);
    const updatedAt = nowIso();
    const persisted = cardLoadInputToPersisted(input);
    const linksJson = JSON.stringify(persisted.links);
    const pageCopyJson = JSON.stringify(persisted.pageCopy);
    const contactJson = JSON.stringify(persisted.contact);
    const copyJson = JSON.stringify(persisted.copy);

    if (existing) {
      await this.db
        .prepare(
          `UPDATE cards SET
            variant = ?, display_name = ?, email = ?, photo_key = ?,
            links_json = ?, page_copy_json = ?, contact_json = ?, copy_json = ?,
            updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          input.variant,
          input.displayName,
          input.email,
          input.photoKey,
          linksJson,
          pageCopyJson,
          contactJson,
          copyJson,
          updatedAt,
          existing.id,
        )
        .run();
      return {
        ...existing,
        ...input,
        id: existing.id,
        updatedAt,
      };
    }

    const id = newId();
    await this.db
      .prepare(
        `INSERT INTO cards (
          id, slug, variant, display_name, email, photo_key,
          links_json, page_copy_json, contact_json, copy_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.slug,
        input.variant,
        input.displayName,
        input.email,
        input.photoKey,
        linksJson,
        pageCopyJson,
        contactJson,
        copyJson,
        updatedAt,
      )
      .run();

    return {
      id,
      ...input,
      updatedAt,
    };
  }

  async upsertHostname(mapping: HostnameMapping): Promise<void> {
    const card = await this.getBySlug(mapping.slug);
    if (!card) {
      throw new Error(`Unknown card slug for hostname mapping: ${mapping.slug}`);
    }
    const hostname = mapping.hostname.toLowerCase();
    await this.db
      .prepare(
        `INSERT INTO hostnames (hostname, card_id) VALUES (?, ?)
         ON CONFLICT(hostname) DO UPDATE SET card_id = excluded.card_id`,
      )
      .bind(hostname, card.id)
      .run();
  }

  async listLeadSinks(cardId: string): Promise<LeadSinkRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT id, card_id, kind, config_json, enabled, created_at, updated_at
         FROM lead_sinks WHERE card_id = ? ORDER BY created_at`,
      )
      .bind(cardId)
      .all<LeadSinksRow>();

    return (result.results ?? []).map((row: LeadSinksRow) => {
      const raw = JSON.parse(row.config_json) as unknown;
      const config = parseLeadSinkConfig(row.kind, raw);
      return mapLeadSinkRow(row, config);
    });
  }

  async addLeadSink(
    cardId: string,
    input: LeadSinkUpsertInput,
  ): Promise<LeadSinkRecord> {
    const id = newId();
    const createdAt = nowIso();
    const updatedAt = createdAt;
    const configJson = serializeLeadSinkConfig(input.kind, input.config);
    await this.db
      .prepare(
        `INSERT INTO lead_sinks (id, card_id, kind, config_json, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        cardId,
        input.kind,
        configJson,
        input.enabled ? 1 : 0,
        createdAt,
        updatedAt,
      )
      .run();
    return {
      id,
      cardId,
      kind: input.kind,
      config: parseLeadSinkConfig(input.kind, JSON.parse(configJson)),
      enabled: input.enabled,
      createdAt,
      updatedAt,
    };
  }

  async updateLeadSink(
    sinkId: string,
    input: Partial<LeadSinkUpsertInput>,
  ): Promise<LeadSinkRecord> {
    const existing = await this.db
      .prepare(
        `SELECT id, card_id, kind, config_json, enabled, created_at, updated_at
         FROM lead_sinks WHERE id = ?`,
      )
      .bind(sinkId)
      .first<LeadSinksRow>();
    if (!existing) {
      throw new Error(`Lead sink not found: ${sinkId}`);
    }

    const kind = input.kind ?? existing.kind;
    const enabled =
      input.enabled !== undefined ? input.enabled : existing.enabled === 1;
    const rawConfig =
      input.config !== undefined
        ? input.config
        : (JSON.parse(existing.config_json) as unknown);
    const configJson = serializeLeadSinkConfig(kind, rawConfig);
    const updatedAt = nowIso();

    await this.db
      .prepare(
        `UPDATE lead_sinks SET kind = ?, config_json = ?, enabled = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(kind, configJson, enabled ? 1 : 0, updatedAt, sinkId)
      .run();

    return {
      id: sinkId,
      cardId: existing.card_id,
      kind,
      config: parseLeadSinkConfig(kind, JSON.parse(configJson)),
      enabled,
      createdAt: existing.created_at,
      updatedAt,
    };
  }

  async removeLeadSink(sinkId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM lead_sinks WHERE id = ?`).bind(sinkId).run();
  }
}
