import type {
  CardLoadInput,
  CardRecord,
  HostnameMapping,
  LeadSinkRecord,
} from "@/card-data/types";

export type LeadSinkUpsertInput = {
  kind: string;
  config: unknown;
  enabled: boolean;
};

export interface CardRepository {
  getBySlug(slug: string): Promise<CardRecord | null>;
  getById(cardId: string): Promise<CardRecord | null>;
  getByHostname(hostname: string): Promise<CardRecord | null>;
  upsertCard(input: CardLoadInput): Promise<CardRecord>;
  upsertHostname(mapping: HostnameMapping): Promise<void>;
  listLeadSinks(cardId: string): Promise<LeadSinkRecord[]>;
  addLeadSink(cardId: string, input: LeadSinkUpsertInput): Promise<LeadSinkRecord>;
  updateLeadSink(
    sinkId: string,
    input: Partial<LeadSinkUpsertInput>,
  ): Promise<LeadSinkRecord>;
  removeLeadSink(sinkId: string): Promise<void>;
}
