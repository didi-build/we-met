import type { ExchangeOwnerEmailSendState } from "@/exchange-owner-email/types";
import { EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS } from "@/exchange/owner-email-timing";

export type ExchangeEmailKind = "owner_email" | "visitor_letter";

/**
 * When details were triggered, fallback queue messages defer so the immediate
 * trigger message can deliver first. After the bounded window, fallback may send.
 */
export function shouldDeferExchangeEmailForTrigger(
  kind: ExchangeEmailKind,
  state: ExchangeOwnerEmailSendState,
  now: Date,
): boolean {
  if (!state.triggeredAt) {
    return false;
  }
  const triggeredMs = Date.parse(state.triggeredAt);
  if (!Number.isFinite(triggeredMs)) {
    return false;
  }
  if (now.getTime() - triggeredMs > EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS) {
    return false;
  }
  if (kind === "owner_email") {
    return !state.ownerEmailSentAt;
  }
  return !state.visitorLetterSentAt;
}
