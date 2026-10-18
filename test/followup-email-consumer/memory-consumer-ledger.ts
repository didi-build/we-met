import type {
  ConsumerLeadDeliveryLedger,
  LeadDeliveryLedgerRow,
  LeadDeliveryPhase,
} from "@/followup-email-consumer/lead-delivery-ledger";

type RowKey = string;

function key(leadId: string, sinkId: string, phase: LeadDeliveryPhase): RowKey {
  return `${leadId}:${sinkId}:${phase}`;
}

type MemoryLedgerRow = LeadDeliveryLedgerRow & {
  attemptCount: number;
  nextAttemptAt: string | null;
  errorCode: string | null;
};

export class MemoryConsumerLeadDeliveryLedger implements ConsumerLeadDeliveryLedger {
  private readonly rows = new Map<RowKey, MemoryLedgerRow>();

  seedQueued(leadId: string, sinkId: string, phase: LeadDeliveryPhase): void {
    this.rows.set(key(leadId, sinkId, phase), {
      status: "queued",
      externalRef: null,
      attemptCount: 0,
      nextAttemptAt: null,
      errorCode: null,
    });
  }

  seedFailed(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
    errorCode: string,
  ): void {
    this.rows.set(key(leadId, sinkId, phase), {
      status: "failed",
      externalRef: null,
      attemptCount: 0,
      nextAttemptAt: null,
      errorCode,
    });
  }

  seedSent(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
    externalRef: string | null = JSON.stringify({
      gmailMessageId: "gmail-1",
      gmailThreadId: "thread-1",
    }),
  ): void {
    this.rows.set(key(leadId, sinkId, phase), {
      status: "sent",
      externalRef,
      attemptCount: 0,
      nextAttemptAt: null,
      errorCode: null,
    });
  }

  getRowState(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
  ): MemoryLedgerRow | undefined {
    return this.rows.get(key(leadId, sinkId, phase));
  }

  async findRow(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
  ): Promise<LeadDeliveryLedgerRow | null> {
    const row = this.rows.get(key(leadId, sinkId, phase));
    if (!row) {
      return null;
    }
    return {
      status: row.status,
      externalRef: row.externalRef,
    };
  }

  async markSent(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    sentAt: string;
    externalRef: string | null;
  }): Promise<boolean> {
    const row = this.rows.get(key(input.leadId, input.sinkId, input.phase));
    if (!row || row.status !== "queued") {
      return false;
    }
    this.rows.set(key(input.leadId, input.sinkId, input.phase), {
      status: "sent",
      externalRef: input.externalRef,
      attemptCount: row.attemptCount,
      nextAttemptAt: null,
      errorCode: null,
    });
    return true;
  }

  async recordFailedAttempt(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    attemptCount: number;
    nextAttemptAt: string;
    updatedAt: string;
  }): Promise<boolean> {
    const row = this.rows.get(key(input.leadId, input.sinkId, input.phase));
    if (!row || row.status !== "queued") {
      return false;
    }
    this.rows.set(key(input.leadId, input.sinkId, input.phase), {
      ...row,
      attemptCount: input.attemptCount,
      nextAttemptAt: input.nextAttemptAt,
    });
    return true;
  }

  async markFailed(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    errorCode: string;
    updatedAt: string;
  }): Promise<boolean> {
    const row = this.rows.get(key(input.leadId, input.sinkId, input.phase));
    if (!row || row.status !== "queued") {
      return false;
    }
    this.rows.set(key(input.leadId, input.sinkId, input.phase), {
      status: "failed",
      externalRef: null,
      attemptCount: row.attemptCount,
      nextAttemptAt: null,
      errorCode: input.errorCode,
    });
    return true;
  }
}
