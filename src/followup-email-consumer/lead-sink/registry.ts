import type { LeadSinkHandler } from "@/followup-email-consumer/lead-sink/types";

export function createLeadSinkHandlerRegistry(handlers: {
  email: LeadSinkHandler;
}): Map<string, LeadSinkHandler> {
  return new Map([["email", handlers.email]]);
}

export function getLeadSinkHandler(
  registry: Map<string, LeadSinkHandler>,
  sinkKind: string,
): LeadSinkHandler | undefined {
  return registry.get(sinkKind);
}
