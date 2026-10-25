import type { VisitorEmailMode } from "@/app-settings/defaults";
import { createExchangeContactCardToken } from "@/exchange/exchange-contact-card-token";

export function relayContactCardTokenForEnqueue(
  masterSecret: string,
  visitorEmailMode: VisitorEmailMode,
  leadId: string,
  cardId: string,
): string | undefined {
  if (visitorEmailMode !== "owner_relay") {
    return undefined;
  }
  return createExchangeContactCardToken(masterSecret, {
    leadId,
    cardId,
  });
}
