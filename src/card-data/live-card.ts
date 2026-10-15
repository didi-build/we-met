import type { CardRepository } from "@/card-data/repository";
import type { CardRecord, LeadSinkRecord } from "@/card-data/types";

export function hasExactlyOneEnabledEmailSink(sinks: LeadSinkRecord[]): boolean {
  return sinks.filter((sink) => sink.kind === "email" && sink.enabled).length === 1;
}

export async function isVisitorVisibleCard(
  repo: CardRepository,
  card: CardRecord,
): Promise<boolean> {
  if (card.status !== "live") {
    return false;
  }
  const sinks = await repo.listLeadSinks(card.id);
  return hasExactlyOneEnabledEmailSink(sinks);
}
