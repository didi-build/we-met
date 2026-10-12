import type { LeadSink } from "@/exchange/lead-sink/types";

const sinksByKind = new Map<string, LeadSink>();

export function registerLeadSinkImplementation(sink: LeadSink): void {
  sinksByKind.set(sink.kind, sink);
}

export function getLeadSinkImplementation(kind: string): LeadSink | undefined {
  return sinksByKind.get(kind);
}

export function clearLeadSinkImplementationsForTests(): void {
  sinksByKind.clear();
}
