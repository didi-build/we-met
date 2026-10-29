import { describe, expect, it } from "vitest";
import { D1CardRepository } from "@/card-data/d1-repository";
import { upsertCardWithEmailSink } from "../helpers/card-email-sink";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("D1CardRepository live card filter (integration)", () => {
  it("getBySlug and getByHostname only return live cards on active accounts", async () => {
    const slug = "d1-live-filter";
    const hostname = "d1-live-filter.example.com";

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      const card = await upsertCardWithEmailSink(repo, {
        ...exampleCardInput(),
        slug,
      });
      await repo.upsertHostname({ hostname, slug });

      expect(await repo.getBySlug(slug)).not.toBeNull();
      expect(await repo.getByHostname(hostname)).not.toBeNull();
      expect(await repo.getById(card.id)).not.toBeNull();

      for (const status of ["suspended", "retired"] as const) {
        await db
          .prepare(`UPDATE cards SET status = ? WHERE id = ?`)
          .bind(status, card.id)
          .run();
        expect(await repo.getBySlug(slug)).toBeNull();
        expect(await repo.getByHostname(hostname)).toBeNull();
        expect(await repo.getById(card.id)).toBeNull();
        await db
          .prepare(`UPDATE cards SET status = 'live' WHERE id = ?`)
          .bind(card.id)
          .run();
      }

      for (const status of ["waitlisted", "suspended", "deleted"] as const) {
        await db
          .prepare(`UPDATE accounts SET status = ? WHERE id = ?`)
          .bind(status, card.accountId)
          .run();
        expect(await repo.getBySlug(slug)).toBeNull();
        expect(await repo.getByHostname(hostname)).toBeNull();
        expect(await repo.getById(card.id)).toBeNull();
        await db
          .prepare(`UPDATE accounts SET status = 'active' WHERE id = ?`)
          .bind(card.accountId)
          .run();
      }
    });
  });
});
