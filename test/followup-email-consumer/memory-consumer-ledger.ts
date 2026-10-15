import type {
  ConsumerLeadDeliveryLedger,
  LeadDeliveryLedgerRow,
  LeadDeliveryPhase,
} from "@/followup-email-consumer/lead-delivery-ledger";

type RowKey = string;

function key(leadId: string, sinkId: string, phase: LeadDeliveryPhase): RowKey {
  return `${leadId}:${sinkId}:${phase}`;
}

export class MemoryConsumerLeadDeliveryLedger implements ConsumerLeadDeliveryLedger {
  private readonly rows = new Map<RowKey, LeadDeliveryLedgerRow>();

  seedQueued(leadId: string, sinkId: string, phase: LeadDeliveryPhase): void {
    this.rows.set(key(leadId, sinkId, phase), {
      status: "queued",
      gmailMessageId: null,
      gmailThreadId: null,
    });
  }

  seedSent(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
    gmailThreadId: string | null = "thread-1",
  ): void {
    this.rows.set(key(leadId, sinkId, phase), {
      status: "sent",
      gmailMessageId: "gmail-1",
      gmailThreadId,
    });
  }

  async findRow(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
  ): Promise<LeadDeliveryLedgerRow | null> {
    return this.rows.get(key(leadId, sinkId, phase)) ?? null;
  }

  async markSent(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    sentAt: string;
    gmailMessageId: string | null;
    gmailThreadId: string | null;
  }): Promise<boolean> {
    const row = this.rows.get(key(input.leadId, input.sinkId, input.phase));
    if (!row || row.status !== "queued") {
      return false;
    }
    this.rows.set(key(input.leadId, input.sinkId, input.phase), {
      status: "sent",
      gmailMessageId: input.gmailMessageId,
      gmailThreadId: input.gmailThreadId,
    });
    return true;
  }

  async recordFailedAttempt(): Promise<boolean> {
    return true;
  }

  async markFailed(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
  }): Promise<boolean> {
    const row = this.rows.get(key(input.leadId, input.sinkId, input.phase));
    if (!row || row.status !== "queued") {
      return false;
    }
    this.rows.set(key(input.leadId, input.sinkId, input.phase), {
      status: "failed",
      gmailMessageId: null,
      gmailThreadId: null,
    });
    return true;
  }
}
