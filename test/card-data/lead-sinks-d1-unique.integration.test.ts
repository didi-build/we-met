import { describe, expect, it } from "vitest";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import { D1CardRepository } from "@/card-data/d1-repository";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("lead_sinks_one_email_per_card (d1 integration)", () => {
  it("rejects a second email sink for the same card", async () => {
    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      const card = await repo.upsertCard({ ...exampleCardInput(), slug: "one-email" });
      await repo.addLeadSink(card.id, {
        kind: "email",
        config: { to: ACCOUNT_EMAIL_SENTINEL },
        enabled: true,
      });
      await expect(
        repo.addLeadSink(card.id, {
          kind: "email",
          config: { to: ACCOUNT_EMAIL_SENTINEL },
          enabled: true,
        }),
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });
  });
});
