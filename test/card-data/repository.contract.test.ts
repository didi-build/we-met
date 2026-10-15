import { afterEach, describe, expect, it } from "vitest";
import { D1CardRepository } from "@/card-data/d1-repository";
import {
  clearLeadSinkKindsForTests,
  registerLeadSinkKind,
} from "@/card-data/lead-sink-registry";
import {
  buildCardsLoadSql,
  newAccountIdsForLoad,
  newCardIdsForLoad,
} from "@/card-data/load-sql";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import type { CardRepository } from "@/card-data/repository";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { exampleCardInput } from "../helpers/example-card";
import { withLocalD1 } from "../helpers/d1";

function registerTestSinkKind() {
  registerLeadSinkKind("test_sink", {
    parse(value: unknown) {
      if (
        typeof value !== "object" ||
        value === null ||
        typeof (value as { to?: unknown }).to !== "string"
      ) {
        throw new Error("Invalid test_sink config");
      }
      return value as { to: string };
    },
  });
}

async function resetD1Tables(db: D1Database) {
  await db.prepare("DELETE FROM lead_sinks").run();
  await db.prepare("DELETE FROM hostnames").run();
  await db.prepare("DELETE FROM cards").run();
  await db.prepare("DELETE FROM card_drafts").run();
  await db.prepare("DELETE FROM sessions").run();
  await db.prepare("DELETE FROM oauth_attempts").run();
  await db.prepare("DELETE FROM accounts").run();
}

function defineContract(
  label: string,
  withRepo: (fn: (repo: CardRepository) => Promise<void>) => Promise<void>,
) {
  describe(`CardRepository contract (${label})`, () => {
    afterEach(() => {
      clearLeadSinkKindsForTests();
    });

    it("round-trips card upsert and slug lookup", async () => {
      await withRepo(async (repo) => {
        const slug = `contract-demo-${label}`;
        const saved = await repo.upsertCard({
          ...exampleCardInput(),
          slug,
        });
        expect(saved.photoKey).toBe("didi");
        const loaded = await repo.getBySlug(slug);
        expect(loaded?.displayName).toBe("Didi Shoukralla");
        expect(loaded?.copy.thanksMessage).toContain("{firstName}");
      });
    });

    it("lists and validates lead sinks", async () => {
      await withRepo(async (repo) => {
        registerTestSinkKind();
        const slug = `contract-demo-sink-${label}`;
        const card = await repo.upsertCard({ ...exampleCardInput(), slug });
        const sink = await repo.addLeadSink(card.id, {
          kind: "test_sink",
          config: { to: "owner@example.com" },
          enabled: true,
        });
        expect(sink.config).toEqual({ to: "owner@example.com" });
        const sinks = await repo.listLeadSinks(card.id);
        expect(sinks).toHaveLength(1);
      });
    });

    it("round-trips hostname mapping case-insensitively", async () => {
      await withRepo(async (repo) => {
        const slug = `contract-demo-host-${label}`;
        await repo.upsertCard({ ...exampleCardInput(), slug });
        await repo.upsertHostname({ hostname: "CARD.Example.COM", slug });
        const byLower = await repo.getByHostname("card.example.com");
        const byUpper = await repo.getByHostname("CARD.EXAMPLE.COM");
        expect(byLower?.slug).toBe(slug);
        expect(byUpper?.slug).toBe(slug);
      });
    });

    it("rejects unknown lead sink kinds", async () => {
      await withRepo(async (repo) => {
        const slug = `contract-demo-reject-${label}`;
        const card = await repo.upsertCard({ ...exampleCardInput(), slug });
        await expect(
          repo.addLeadSink(card.id, {
            kind: "unknown",
            config: {},
            enabled: true,
          }),
        ).rejects.toThrow(/Unknown lead sink kind/);
      });
    });
  });
}

defineContract("memory", async (fn) => {
  await fn(new MemoryCardRepository());
});

defineContract("d1", async (fn) => {
  await withLocalD1(async (db) => {
    await resetD1Tables(db);
    await fn(new D1CardRepository(db));
  });
});

describe("load SQL hostname mapping (d1 integration)", () => {
  it("maps hostname to the card loaded via SQL", async () => {
    await withLocalD1(async (db) => {
      await resetD1Tables(db);
      const repo = new D1CardRepository(db);
      const slug = "sql-host-demo";
      const loadFile = {
        cards: [{ ...exampleCardInput(), slug }],
        hostnames: [{ hostname: "card.sql-test.example", slug }],
      };
      const sql = buildCardsLoadSql(loadFile, {
        updatedAt: "2026-10-11T12:00:00.000Z",
        newCardIds: newCardIdsForLoad(loadFile),
        accountIds: newAccountIdsForLoad(loadFile),
      });
      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
      const card = await repo.getByHostname("card.sql-test.example");
      expect(card?.slug).toBe(slug);
    });
  });
});
