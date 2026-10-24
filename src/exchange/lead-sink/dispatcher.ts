import type { LeadSinkRecord } from "@/card-data/types";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";
import { OWNER_EMAIL_FALLBACK_DELAY_SECONDS } from "@/exchange/owner-email-timing";
import type { QueueSendOptions } from "@/exchange/queue/producer";
import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";
import { computeLeadDeliveryRetryUntilIso } from "@/lead-delivery-ledger/retry-until";
import type {
  DailySendCountIncrement,
  LeadDeliveryLedger,
} from "@/lead-delivery-ledger/types";
import type { LeadSinkQueueProducer } from "@/exchange/queue/producer";

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
  exchangeOwnerEmail: ExchangeOwnerEmailStore;
  now: () => Date;
  createLedgerId: () => string;
  /** When set, the first ledger insert in this dispatch also increments daily_send_counts. */
  dailySendOnFirstLedger?: DailySendCountIncrement;
};

const EMPTY_DETAILS: VisitorLeadDetails = {
  phone: null,
  jobTitle: null,
  company: null,
  note: null,
};

function ownerEmailQueuePayload(
  sink: LeadSinkRecord,
  lead: VisitorLead,
  details: VisitorLeadDetails,
  cardId: string,
  cardSlug: string,
  sourceUrl: string,
  ownerFirstName?: string,
) {
  return {
    sinkId: sink.id,
    sinkKind: sink.kind,
    sinkConfig: sink.config,
    lead,
    details,
    cardId,
    cardSlug,
    sourceUrl,
    ...(ownerFirstName ? { ownerFirstName } : {}),
  };
}

export async function dispatchLeadOnExchange(
  sinks: LeadSinkRecord[],
  lead: VisitorLead,
  cardId: string,
  cardSlug: string,
  sourceUrl: string,
  ownerFirstName: string | undefined,
  deps: LeadSinkDispatchDeps,
): Promise<void> {
  const enabled = sinks.filter((s) => s.enabled);
  const now = deps.now();
  const createdAt = now.toISOString();

  await deps.exchangeOwnerEmail.ensurePending({
    leadId: lead.leadId,
    cardId,
    createdAt,
  });

  if (enabled.length === 0) {
    return;
  }

  const retryUntil = computeLeadDeliveryRetryUntilIso(now);

  let dailySendApplied = false;
  for (const sink of enabled) {
    try {
      const ledgerInput = {
        id: deps.createLedgerId(),
        leadId: lead.leadId,
        cardId,
        sinkId: sink.id,
        sinkKind: sink.kind,
        phase: "record" as const,
        retryUntil,
        createdAt,
      };
      if (deps.dailySendOnFirstLedger && !dailySendApplied) {
        await deps.ledger.insertQueuedRowWithDailySendIncrements(
          ledgerInput,
          deps.dailySendOnFirstLedger,
        );
        dailySendApplied = true;
      } else {
        await deps.ledger.insertQueuedRow(ledgerInput);
      }
    } catch {
      deps.deliveryLogger.logLedgerWriteFailed(
        lead.leadId,
        sink.id,
        "ledger_write_failed",
      );
      continue;
    }

    const queueOptions: QueueSendOptions = {
      delaySeconds: OWNER_EMAIL_FALLBACK_DELAY_SECONDS,
    };
    try {
      await deps.producer.enqueueLeadSink(
        {
          type: "owner_email_due",
          ...ownerEmailQueuePayload(
            sink,
            lead,
            EMPTY_DETAILS,
            cardId,
            cardSlug,
            sourceUrl,
            ownerFirstName,
          ),
        },
        queueOptions,
      );
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

export type OwnerEmailImmediateDispatchOutcome = "enqueued" | "already_sent" | "failed";

export async function dispatchOwnerEmailImmediate(
  sinks: LeadSinkRecord[],
  lead: VisitorLead,
  details: VisitorLeadDetails,
  cardId: string,
  cardSlug: string,
  sourceUrl: string,
  ownerFirstName: string | undefined,
  deps: LeadSinkDispatchDeps,
): Promise<OwnerEmailImmediateDispatchOutcome> {
  const enabled = sinks.filter((s) => s.enabled);
  if (enabled.length === 0) {
    return "enqueued";
  }

  let anyWriteFailed = false;
  let anyEnqueued = false;

  for (const sink of enabled) {
    try {
      await deps.producer.enqueueLeadSink({
        type: "lead_sink_owner_email",
        ...ownerEmailQueuePayload(
          sink,
          lead,
          details,
          cardId,
          cardSlug,
          sourceUrl,
          ownerFirstName,
        ),
      });
      anyEnqueued = true;
    } catch (error) {
      deps.sinkLogger.logSinkEnqueueFailure(sink.id, error);
      deps.deliveryLogger.logLedgerEnqueueFailed(
        lead.leadId,
        sink.id,
        "enqueue_failed",
      );
      anyWriteFailed = true;
    }
  }

  if (anyWriteFailed) {
    return "failed";
  }
  if (!anyEnqueued) {
    return "already_sent";
  }
  return "enqueued";
}

/** @deprecated Retained for in-flight queue messages during rollout. */
export type DetailsAppendDispatchOutcome = "inserted" | "already_exists" | "failed";

/** @deprecated Use {@link dispatchOwnerEmailImmediate}. */
export async function dispatchDetailsAppend(
  sinks: LeadSinkRecord[],
  lead: VisitorLead,
  details: VisitorLeadDetails,
  cardId: string,
  cardSlug: string,
  sourceUrl: string,
  _detailsSubmittedAt: string,
  deps: LeadSinkDispatchDeps,
  ownerFirstName?: string,
): Promise<DetailsAppendDispatchOutcome> {
  const outcome = await dispatchOwnerEmailImmediate(
    sinks,
    lead,
    details,
    cardId,
    cardSlug,
    sourceUrl,
    ownerFirstName,
    deps,
  );
  if (outcome === "failed") {
    return "failed";
  }
  if (outcome === "already_sent") {
    return "already_exists";
  }
  return "inserted";
}
