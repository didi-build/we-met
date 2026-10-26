import type { VisitorEmailMode } from "@/app-settings/defaults";
import { relayContactCardTokenForEnqueue } from "@/exchange/relay-contact-card-token";

/**
 * Reads visitor email mode (defaulting to direct on read failure, matching main), then mints a
 * relay contact-card token when mode is owner_relay.
 */
export async function resolveRelayContactCardTokenForEnqueue(
  masterSecret: string,
  resolveVisitorEmailMode: () => Promise<VisitorEmailMode>,
  leadId: string,
  cardId: string,
): Promise<string | undefined> {
  let visitorEmailMode: VisitorEmailMode = "direct";
  try {
    visitorEmailMode = await resolveVisitorEmailMode();
  } catch {
    console.error("visitor_email_mode_read_failed", { leadId });
    visitorEmailMode = "direct";
  }

  try {
    return relayContactCardTokenForEnqueue(
      masterSecret,
      visitorEmailMode,
      leadId,
      cardId,
    );
  } catch {
    if (visitorEmailMode === "owner_relay") {
      console.error("relay_contact_card_token_failed", { leadId });
    }
    return undefined;
  }
}
