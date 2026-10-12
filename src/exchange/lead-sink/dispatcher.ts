import type { LeadSinkRecord } from "@/card-data/types";
import type { LeadSinkQueueProducer } from "@/exchange/queue/producer";
import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";

export type LeadSinkDispatchLogger = {
  logSinkEnqueueFailure(sinkId: string, error: unknown): void;
};

export async function dispatchLeadOnExchange(
  sinks: LeadSinkRecord[],
  lead: VisitorLead,
  cardId: string,
  cardSlug: string,
  producer: LeadSinkQueueProducer,
  logger: LeadSinkDispatchLogger,
): Promise<void> {
  const enabled = sinks.filter((s) => s.enabled);
  for (const sink of enabled) {
    try {
      await producer.enqueueLeadSink({
        type: "lead_sink_record",
        sinkId: sink.id,
        sinkKind: sink.kind,
        sinkConfig: sink.config,
        lead,
        cardId,
        cardSlug,
      });
    } catch (error) {
      logger.logSinkEnqueueFailure(sink.id, error);
    }
  }
}

export async function dispatchDetailsAppend(
  sinks: LeadSinkRecord[],
  lead: VisitorLead,
  details: VisitorLeadDetails,
  cardId: string,
  cardSlug: string,
  producer: LeadSinkQueueProducer,
  logger: LeadSinkDispatchLogger,
): Promise<void> {
  const enabled = sinks.filter((s) => s.enabled);
  for (const sink of enabled) {
    try {
      await producer.enqueueLeadSink({
        type: "lead_sink_append_details",
        sinkId: sink.id,
        sinkKind: sink.kind,
        sinkConfig: sink.config,
        lead,
        details,
        cardId,
        cardSlug,
      });
    } catch (error) {
      logger.logSinkEnqueueFailure(sink.id, error);
    }
  }
}
