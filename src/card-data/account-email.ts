import type { EmailLeadSinkConfig } from "@/card-data/lead-sink-kinds/email";
import type { LeadSinkRecord } from "@/card-data/types";

/** v1 email sink destination stored in D1; resolved to accounts.email at enqueue and render. */
export const ACCOUNT_EMAIL_SENTINEL = "account_email";

export function resolveEmailLeadSinkConfig(
  config: EmailLeadSinkConfig,
  ownerEmail: string,
): EmailLeadSinkConfig {
  if (config.to !== ACCOUNT_EMAIL_SENTINEL) {
    return config;
  }
  return { to: ownerEmail };
}

export function resolveLeadSinksForDispatch(
  sinks: LeadSinkRecord[],
  ownerEmail: string,
): LeadSinkRecord[] {
  return sinks.map((sink) => {
    if (sink.kind !== "email") {
      return sink;
    }
    const config = sink.config as EmailLeadSinkConfig;
    return {
      ...sink,
      config: resolveEmailLeadSinkConfig(config, ownerEmail),
    };
  });
}
