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

  it("reports append phase rows per lead", async () => {
    await withIsolatedLocalD1(async (db) => {
      const ledger = createLeadDeliveryLedgerFromD1(db);
      expect(await ledger.hasAppendPhaseForLead("lead-1")).toBe(false);
      await ledger.insertAppendIfAbsent({
        id: "row-1",
        leadId: "lead-1",
        cardId: "card-1",
        sinkId: "sink-1",
        sinkKind: "email",
        phase: "append",
        retryUntil: "2026-10-13T12:00:00.000Z",
        createdAt: "2026-10-12T12:00:00.000Z",
      });
      expect(await ledger.hasAppendPhaseForLead("lead-1")).toBe(true);
      expect(await ledger.hasAppendPhaseForLead("lead-2")).toBe(false);
    });
  });

  it("does not increment daily_send_counts when append ledger insert conflicts", async () => {
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
      const inserted = await ledger.insertAppendIfAbsentWithDailySendIncrements(base, {
        day: "2026-10-12",
        cardId: "card-1",
        kinds: ["owner"],
      });
      expect(inserted).toBe(true);
      const skipped = await ledger.insertAppendIfAbsentWithDailySendIncrements(
        { ...base, id: "row-2" },
        { day: "2026-10-12", cardId: "card-1", kinds: ["owner"] },
      );
      expect(skipped).toBe(false);
      const row = await db
        .prepare(
          `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'owner'`,
        )
        .bind("2026-10-12", "card-1")
        .first<{ count: number }>();
      expect(row?.count).toBe(1);
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
