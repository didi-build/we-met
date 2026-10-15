import { describe, expect, it } from "vitest";
import { LEAD_DELIVERY_LEDGER_COLUMNS } from "@/lead-delivery-ledger/schema";

describe("lead_delivery_ledger schema (unit)", () => {
  it("lists metadata columns only (no visitor PII or sink destinations)", () => {
    expect([...LEAD_DELIVERY_LEDGER_COLUMNS].sort()).toEqual(
      [
        "attempt_count",
        "card_id",
        "created_at",
        "error_code",
        "gmail_message_id",
        "gmail_thread_id",
        "id",
        "lead_id",
        "next_attempt_at",
        "phase",
        "retry_until",
        "sent_at",
        "sink_id",
        "sink_kind",
        "status",
        "updated_at",
      ].sort(),
    );
    const forbidden = [
      "name",
      "email",
      "phone",
      "note",
      "job_title",
      "company",
      "config",
      "destination",
      "to_address",
    ];
    for (const col of LEAD_DELIVERY_LEDGER_COLUMNS) {
      expect(forbidden).not.toContain(col);
    }
  });
});
