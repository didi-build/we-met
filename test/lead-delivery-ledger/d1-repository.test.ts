import { describe, expect, it } from "vitest";
import { createLeadDeliveryLedgerFromD1 } from "@/lead-delivery-ledger/d1-repository";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("lead delivery ledger D1 (integration)", () => {
  it("enforces UNIQUE (lead_id, sink_id, phase)", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ledger = createLeadDeliveryLedgerFromD1(db);
      const base = {
        id: "row-1",
        leadId: "lead-1",
        cardId: "card-1",
        sinkId: "sink-1",
        sinkKind: "email",
        phase: "append" as const,
        retryUntil: "2026-10-13T12:00:00.000Z",
        createdAt: "2026-10-12T12:00:00.000Z",
      };
      await ledger.insertQueuedRow(base);
      const second = await ledger.insertAppendIfAbsent({
        ...base,
        id: "row-2",
      });
      expect(second).toBe(false);
    });
  });

  it("rejects invalid phase via CHECK constraint", async () => {
    await withIsolatedLocalD1(async (db) => {
      await expect(
        db
          .prepare(
            `INSERT INTO lead_delivery_ledger (
              id, lead_id, card_id, sink_id, sink_kind, phase, status,
              attempt_count, retry_until, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'invalid', 'queued', 0, ?, ?, ?)`,
          )
          .bind(
            "x",
            "lead-1",
            "card-1",
            "sink-1",
            "email",
            "2026-10-13T12:00:00.000Z",
            "2026-10-12T12:00:00.000Z",
            "2026-10-12T12:00:00.000Z",
          )
          .run(),
      ).rejects.toThrow();
    });
  });
});
