import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import type { CardRepository } from "@/card-data/repository";
import type { CardLoadInput, CardRecord } from "@/card-data/types";

export async function upsertCardWithEmailSink(
  repo: CardRepository,
  input: CardLoadInput,
): Promise<CardRecord> {
  const card = await repo.upsertCard(input);
  await repo.addLeadSink(card.id, {
    kind: "email",
    config: { to: ACCOUNT_EMAIL_SENTINEL },
    enabled: true,
  });
  return card;
}
