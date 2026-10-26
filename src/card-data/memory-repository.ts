import {
  parseLeadSinkConfig,
  serializeLeadSinkConfig,
} from "@/card-data/lead-sink-registry";
import type { LeadSinkUpsertInput, CardRepository } from "@/card-data/repository";
import type {
  CardLoadInput,
  CardRecord,
  CardStatus,
  HostnameMapping,
  LeadSinkRecord,
} from "@/card-data/types";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

type MemoryAccount = {
  id: string;
  email: string;
  status: "active" | "waitlisted" | "suspended" | "deleted";
};

export class MemoryCardRepository implements CardRepository {
  private readonly cardsBySlug = new Map<string, CardRecord>();
  private readonly hostnames = new Map<string, string>();
  private readonly leadSinks = new Map<string, LeadSinkRecord>();
  private readonly accounts = new Map<string, MemoryAccount>();

  private ensureAccount(input: CardLoadInput, existingAccountId?: string): string {
    if (input.accountId) {
      const account = this.accounts.get(input.accountId);
      if (!account) {
        throw new Error(`Unknown account id for card load: ${input.accountId}`);
      }
      account.email = input.email.toLowerCase();
      return input.accountId;
    }
    if (existingAccountId) {
      const account = this.accounts.get(existingAccountId);
      if (account) {
        account.email = input.email.toLowerCase();
      }
      return existingAccountId;
    }
    const id = newId();
    this.accounts.set(id, {
      id,
      email: input.email.toLowerCase(),
      status: "active",
    });
    return id;
  }

  private isPublicCard(card: CardRecord): boolean {
    const account = this.accounts.get(card.accountId);
    return card.status === "live" && account?.status === "active";
  }

  /** Test helper: set card status without going through publish flows. */
  setCardStatusForTest(cardId: string, status: CardStatus): void {
    for (const card of this.cardsBySlug.values()) {
      if (card.id === cardId) {
        const updated = { ...card, status };
        this.cardsBySlug.set(card.slug, updated);
        return;
      }
    }
    throw new Error(`Unknown card id: ${cardId}`);
  }

  /** Test helper: change slug while keeping the same card id. */
  renameSlugForTest(cardId: string, newSlug: string): void {
    for (const [oldSlug, card] of this.cardsBySlug.entries()) {
      if (card.id === cardId) {
        this.cardsBySlug.delete(oldSlug);
        this.cardsBySlug.set(newSlug, { ...card, slug: newSlug });
        return;
      }
    }
    throw new Error(`Unknown card id: ${cardId}`);
  }

  /** Test helper: set account status without going through sign-in. */
  setAccountStatus(accountId: string, status: MemoryAccount["status"]): void {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Unknown account id: ${accountId}`);
    }
    account.status = status;
  }

  async getBySlug(slug: string): Promise<CardRecord | null> {
    const card = this.cardsBySlug.get(slug) ?? null;
    if (!card || !this.isPublicCard(card)) {
      return null;
    }
    return card;
  }

  async getById(cardId: string): Promise<CardRecord | null> {
    for (const card of this.cardsBySlug.values()) {
      if (card.id === cardId) {
        return this.isPublicCard(card) ? card : null;
      }
    }
    return null;
  }

  async getByHostname(hostname: string): Promise<CardRecord | null> {
    const cardId = this.hostnames.get(hostname.toLowerCase());
    if (!cardId) {
      return null;
    }
    for (const card of this.cardsBySlug.values()) {
      if (card.id === cardId) {
        return this.isPublicCard(card) ? card : null;
      }
    }
    return null;
  }

  async upsertCard(input: CardLoadInput): Promise<CardRecord> {
    const existing = this.cardsBySlug.get(input.slug);
    const updatedAt = nowIso();
    const status: CardStatus = input.status ?? "live";
    const accountId = this.ensureAccount(input, existing?.accountId);
    const record: CardRecord = {
      ...input,
      id: existing?.id ?? newId(),
      accountId,
      status,
      email: input.email.toLowerCase(),
      updatedAt,
    };
    this.cardsBySlug.set(input.slug, record);
    return record;
  }

  async upsertHostname(mapping: HostnameMapping): Promise<void> {
    const card = this.cardsBySlug.get(mapping.slug);
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
