import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
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
import { clearLocalD1Tables, openIsolatedLocalD1 } from "../helpers/d1";
import { upsertCardWithEmailSink } from "../helpers/card-email-sink";

let db: D1Database;
let closeD1: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const handle = await openIsolatedLocalD1();
  db = handle.db;
  closeD1 = handle.close;
});

afterAll(async () => {
  await closeD1?.();
});

beforeEach(async () => {
  await clearLocalD1Tables(db);
});

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

    it("loads live cards by stable id", async () => {
      await withRepo(async (repo) => {
        const slug = `contract-demo-id-${label}`;
        const saved = await repo.upsertCard({
          ...exampleCardInput(),
          slug,
        });
        const byId = await repo.getById(saved.id);
        expect(byId?.slug).toBe(slug);
        expect(byId?.id).toBe(saved.id);
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
  await fn(new D1CardRepository(db));
});

describe("CardRepository getById visibility", () => {
  it("memory returns null for non-live cards and inactive accounts", async () => {
    const mem = new MemoryCardRepository();
    const slug = "contract-getbyid-memory";
    const saved = await mem.upsertCard({
      ...exampleCardInput(),
      slug,
    });
    expect(await mem.getById(saved.id)).not.toBeNull();
    mem.setCardStatusForTest(saved.id, "retired");
    expect(await mem.getById(saved.id)).toBeNull();
    mem.setCardStatusForTest(saved.id, "live");
    mem.setAccountStatus(saved.accountId, "suspended");
    expect(await mem.getById(saved.id)).toBeNull();
  });

  it("d1 returns null for non-live cards and inactive accounts", async () => {
    const repo = new D1CardRepository(db);
    const slug = "contract-getbyid-d1";
    const card = await upsertCardWithEmailSink(repo, {
      ...exampleCardInput(),
      slug,
    });
    expect(await repo.getById(card.id)).not.toBeNull();
    await db
      .prepare(`UPDATE cards SET status = ? WHERE id = ?`)
      .bind("retired", card.id)
      .run();
    expect(await repo.getById(card.id)).toBeNull();
    await db
      .prepare(`UPDATE cards SET status = 'live' WHERE id = ?`)
      .bind(card.id)
      .run();
    await db
      .prepare(`UPDATE accounts SET status = ? WHERE id = ?`)
      .bind("suspended", card.accountId)
      .run();
    expect(await repo.getById(card.id)).toBeNull();
  });
});

describe("load SQL hostname mapping (d1 integration)", () => {
  it("maps hostname to the card loaded via SQL", async () => {
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
