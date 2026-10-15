import type { LeadSinkRecord } from "@/card-data/types";
import { computeLeadDeliveryRetryUntilIso } from "@/lead-delivery-ledger/retry-until";
import type { LeadDeliveryLedger } from "@/lead-delivery-ledger/types";
import type { LeadSinkQueueProducer } from "@/exchange/queue/producer";
import type {
  LeadSinkAppendLead,
  VisitorLead,
  VisitorLeadDetails,
} from "@/exchange/types";

export type LeadSinkDispatchLogger = {
  logSinkEnqueueFailure(sinkId: string, error: unknown): void;
};

export type LeadDeliveryDispatchLogger = {
  logLedgerWriteFailed(leadId: string, sinkId: string, errorCode: string): void;
  logLedgerEnqueueFailed(leadId: string, sinkId: string, errorCode: string): void;
};

export type LeadSinkDispatchDeps = {
  producer: LeadSinkQueueProducer;
  sinkLogger: LeadSinkDispatchLogger;
  ledger: LeadDeliveryLedger;
  deliveryLogger: LeadDeliveryDispatchLogger;
  now: () => Date;
  createLedgerId: () => string;
};

export async function dispatchLeadOnExchange(
  sinks: LeadSinkRecord[],
  lead: VisitorLead,
  cardId: string,
  cardSlug: string,
  sourceUrl: string,
  deps: LeadSinkDispatchDeps,
): Promise<void> {
  const enabled = sinks.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return;
  }

  const now = deps.now();
  const createdAt = now.toISOString();
  const retryUntil = computeLeadDeliveryRetryUntilIso(now);

  for (const sink of enabled) {
    try {
      await deps.ledger.insertQueuedRow({
        id: deps.createLedgerId(),
        leadId: lead.leadId,
        cardId,
        sinkId: sink.id,
        sinkKind: sink.kind,
        phase: "record",
        retryUntil,
        createdAt,
      });
    } catch {
      deps.deliveryLogger.logLedgerWriteFailed(
        lead.leadId,
        sink.id,
        "ledger_write_failed",
      );
      continue;
    }

    try {
      await deps.producer.enqueueLeadSink({
        type: "lead_sink_record",
        sinkId: sink.id,
        sinkKind: sink.kind,
        sinkConfig: sink.config,
        lead,
        cardId,
        cardSlug,
        sourceUrl,
      });
    } catch (error) {
      deps.sinkLogger.logSinkEnqueueFailure(sink.id, error);
      deps.deliveryLogger.logLedgerEnqueueFailed(
        lead.leadId,
        sink.id,
        "enqueue_failed",
      );
      try {
        await deps.ledger.markFailed(
          lead.leadId,
          sink.id,
          "record",
          "enqueue_failed",
          deps.now().toISOString(),
        );
      } catch {
        // Best-effort; row may be missing if insert raced.
      }
    }
  }
}

export async function dispatchDetailsAppend(
  sinks: LeadSinkRecord[],
  lead: LeadSinkAppendLead,
  details: VisitorLeadDetails,
  cardId: string,
  cardSlug: string,
  sourceUrl: string,
  detailsSubmittedAt: string,
  deps: LeadSinkDispatchDeps,
): Promise<void> {
  const enabled = sinks.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return;
  }

  const now = deps.now();
  const createdAt = now.toISOString();
  const retryUntil = computeLeadDeliveryRetryUntilIso(now);

  for (const sink of enabled) {
    let inserted = false;
    try {
      inserted = await deps.ledger.insertAppendIfAbsent({
        id: deps.createLedgerId(),
        leadId: lead.leadId,
        cardId,
        sinkId: sink.id,
        sinkKind: sink.kind,
        phase: "append",
        retryUntil,
        createdAt,
      });
    } catch {
      deps.deliveryLogger.logLedgerWriteFailed(
        lead.leadId,
        sink.id,
        "ledger_write_failed",
      );
      continue;
    }

    if (!inserted) {
      continue;
    }

    try {
      await deps.producer.enqueueLeadSink({
        type: "lead_sink_append_details",
        sinkId: sink.id,
        sinkKind: sink.kind,
        sinkConfig: sink.config,
        lead,
        details,
        cardId,
        cardSlug,
        sourceUrl,
        detailsSubmittedAt,
      });
    } catch (error) {
      deps.sinkLogger.logSinkEnqueueFailure(sink.id, error);
      deps.deliveryLogger.logLedgerEnqueueFailed(
        lead.leadId,
        sink.id,
        "enqueue_failed",
      );
      try {
        await deps.ledger.markFailed(
          lead.leadId,
          sink.id,
          "append",
          "enqueue_failed",
          deps.now().toISOString(),
        );
      } catch {
        // Best-effort.
      }
    }
  }
}
