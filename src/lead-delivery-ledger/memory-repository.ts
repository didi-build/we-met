import type {
  InsertQueuedLeadDeliveryInput,
  LeadDeliveryLedger,
  LeadDeliveryPhase,
} from "@/lead-delivery-ledger/types";

type Row = InsertQueuedLeadDeliveryInput & {
  status: "queued" | "sent" | "failed";
  errorCode: string | null;
};

export class MemoryLeadDeliveryLedger implements LeadDeliveryLedger {
  readonly rows: Row[] = [];

  async insertQueuedRow(input: InsertQueuedLeadDeliveryInput): Promise<void> {
    const key = rowKey(input.leadId, input.sinkId, input.phase);
    if (this.rows.some((r) => rowKey(r.leadId, r.sinkId, r.phase) === key)) {
      throw new Error("lead_delivery_ledger_unique_violation");
    }
    this.rows.push({ ...input, status: "queued", errorCode: null });
  }

  async insertAppendIfAbsent(input: InsertQueuedLeadDeliveryInput): Promise<boolean> {
    const key = rowKey(input.leadId, input.sinkId, "append");
    if (this.rows.some((r) => rowKey(r.leadId, r.sinkId, r.phase) === key)) {
      return false;
    }
    this.rows.push({ ...input, phase: "append", status: "queued", errorCode: null });
    return true;
  }

  async markFailed(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
    errorCode: string,
    _updatedAt: string,
  ): Promise<void> {
    const row = this.rows.find(
      (r) => r.leadId === leadId && r.sinkId === sinkId && r.phase === phase,
    );
    if (row) {
      row.status = "failed";
      row.errorCode = errorCode;
    }
  }
}

function rowKey(leadId: string, sinkId: string, phase: LeadDeliveryPhase): string {
  return `${leadId}\0${sinkId}\0${phase}`;
}
