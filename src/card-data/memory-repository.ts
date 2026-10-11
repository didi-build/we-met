import {
  parseLeadSinkConfig,
  serializeLeadSinkConfig,
} from "@/card-data/lead-sink-registry";
import type { LeadSinkUpsertInput, CardRepository } from "@/card-data/repository";
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

export class MemoryCardRepository implements CardRepository {
  private readonly cardsBySlug = new Map<string, CardRecord>();
  private readonly hostnames = new Map<string, string>();
  private readonly leadSinks = new Map<string, LeadSinkRecord>();

  async getBySlug(slug: string): Promise<CardRecord | null> {
    return this.cardsBySlug.get(slug) ?? null;
  }

  async getByHostname(hostname: string): Promise<CardRecord | null> {
    const cardId = this.hostnames.get(hostname.toLowerCase());
    if (!cardId) {
      return null;
    }
    for (const card of this.cardsBySlug.values()) {
      if (card.id === cardId) {
        return card;
      }
    }
    return null;
  }

  async upsertCard(input: CardLoadInput): Promise<CardRecord> {
    const existing = this.cardsBySlug.get(input.slug);
    const updatedAt = nowIso();
    const record: CardRecord = {
      id: existing?.id ?? newId(),
      ...input,
      updatedAt,
    };
    this.cardsBySlug.set(input.slug, record);
    return record;
  }

  async upsertHostname(mapping: HostnameMapping): Promise<void> {
    const card = await this.getBySlug(mapping.slug);
    if (!card) {
      throw new Error(`Unknown card slug for hostname mapping: ${mapping.slug}`);
    }
    this.hostnames.set(mapping.hostname.toLowerCase(), card.id);
  }

  async listLeadSinks(cardId: string): Promise<LeadSinkRecord[]> {
    return [...this.leadSinks.values()].filter((s) => s.cardId === cardId);
  }

  async addLeadSink(
    cardId: string,
    input: LeadSinkUpsertInput,
  ): Promise<LeadSinkRecord> {
    const createdAt = nowIso();
    const config = parseLeadSinkConfig(
      input.kind,
      JSON.parse(serializeLeadSinkConfig(input.kind, input.config)),
    );
    const record: LeadSinkRecord = {
      id: newId(),
      cardId,
      kind: input.kind,
      config,
      enabled: input.enabled,
      createdAt,
      updatedAt: createdAt,
    };
    this.leadSinks.set(record.id, record);
    return record;
  }

  async updateLeadSink(
    sinkId: string,
    input: Partial<LeadSinkUpsertInput>,
  ): Promise<LeadSinkRecord> {
    const existing = this.leadSinks.get(sinkId);
    if (!existing) {
      throw new Error(`Lead sink not found: ${sinkId}`);
    }
    const kind = input.kind ?? existing.kind;
    const enabled = input.enabled ?? existing.enabled;
    const configSource = input.config !== undefined ? input.config : existing.config;
    const config = parseLeadSinkConfig(kind, configSource);
    const updated: LeadSinkRecord = {
      ...existing,
      kind,
      enabled,
      config,
      updatedAt: nowIso(),
    };
    this.leadSinks.set(sinkId, updated);
    return updated;
  }

  async removeLeadSink(sinkId: string): Promise<void> {
    this.leadSinks.delete(sinkId);
  }
}
