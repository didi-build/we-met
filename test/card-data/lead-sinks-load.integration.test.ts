import { describe, expect, it } from "vitest";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import {
  parseCardsLoadFile,
  validateNonProdEmailSinkDestinations,
} from "@/card-data/load-file";
import {
  buildCardsLoadSql,
  newAccountIdsForLoad,
  newCardIdsForLoad,
} from "@/card-data/load-sql";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { D1CardRepository } from "@/card-data/d1-repository";
import type { CardsLoadFile } from "@/card-data/types";
import { exampleLoadRaw } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";
import {
  MAX_EMAIL_SINKS_PER_CARD,
  MAX_LEAD_SINKS_PER_CARD,
} from "@/card-data/load-limits";

function cardWithSinks(leadSinks: unknown) {
  const raw = exampleLoadRaw() as { cards: Record<string, unknown>[] };
  raw.cards[0] = { ...raw.cards[0], leadSinks };
  return raw;
}

const accountEmailSink = {
  id: "didi-inbox-a",
  kind: "email",
  config: { to: ACCOUNT_EMAIL_SENTINEL },
};

describe("leadSinks load file", () => {
  it("accepts a valid email sink", () => {
    const file = parseCardsLoadFile(cardWithSinks([accountEmailSink]));
    expect(file.cards[0].leadSinks).toHaveLength(1);
  });

  it("rejects a second email sink on the same card", () => {
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          accountEmailSink,
          {
            id: "didi-inbox-b",
            kind: "email",
            config: { to: ACCOUNT_EMAIL_SENTINEL },
          },
        ]),
      ),
    ).toThrow(new RegExp(`${MAX_EMAIL_SINKS_PER_CARD}`));
  });

  it("rejects unknown kinds", () => {
    expect(() =>
      parseCardsLoadFile(cardWithSinks([{ id: "didi-x", kind: "linear", config: {} }])),
    ).toThrow(/Unknown lead sink kind/);
  });

  it("rejects literal email addresses and extra config keys", () => {
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          { id: "didi-bad", kind: "email", config: { to: "not an email" } },
        ]),
      ),
    ).toThrow(/account_email/);
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          {
            id: "didi-bad2",
            kind: "email",
            config: { to: ACCOUNT_EMAIL_SENTINEL, extra: true },
          },
        ]),
      ),
    ).toThrow(/Unexpected field/);
  });

  it("rejects duplicate sink ids and invalid ids", () => {
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          accountEmailSink,
          { id: "didi-inbox-a", kind: "email", config: { to: ACCOUNT_EMAIL_SENTINEL } },
        ]),
      ),
    ).toThrow(/Duplicate lead sink id/);
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          { id: "didi-Bad-ID", kind: "email", config: { to: ACCOUNT_EMAIL_SENTINEL } },
        ]),
      ),
    ).toThrow(/must match/);
  });

  it("enforces per-card caps", () => {
    const many = Array.from({ length: MAX_LEAD_SINKS_PER_CARD + 1 }, (_, i) => ({
      id: `didi-sink-${i}`,
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
    }));
    expect(() => parseCardsLoadFile(cardWithSinks(many))).toThrow(
      new RegExp(`${MAX_LEAD_SINKS_PER_CARD}`),
    );
  });

  it("rejects sink ids without the card slug prefix", () => {
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          { id: "inbox-a", kind: "email", config: { to: ACCOUNT_EMAIL_SENTINEL } },
        ]),
      ),
    ).toThrow(/must start with "didi-"/);
    const file = parseCardsLoadFile(cardWithSinks([accountEmailSink]));
    expect(file.cards[0].leadSinks?.[0].id).toBe("didi-inbox-a");
  });

  it("rejects root-level leadSinks", () => {
    const raw = exampleLoadRaw() as Record<string, unknown>;
    raw.leadSinks = [];
    expect(() => parseCardsLoadFile(raw)).toThrow(/each card object/);
  });
});

function loadSqlOptions(loadFile: CardsLoadFile) {
  const updatedAt = "2026-10-15T12:00:00.000Z";
  return {
    updatedAt,
    newCardIds: newCardIdsForLoad(loadFile),
    accountIds: newAccountIdsForLoad(loadFile),
  };
}

// getPlatformProxy against wrangler.jsonc plus all migrations can exceed 5s on a cold CI runner.
describe("leadSinks load SQL reconcile (integration)", { timeout: 20000 }, () => {
  it("leaves sinks untouched when leadSinks key is absent", async () => {
    const parsed = parseCardsLoadFile(exampleLoadRaw()).cards[0];
    const { leadSinks: _omit, ...card } = parsed;
    const withSinks = parseCardsLoadFile(cardWithSinks([accountEmailSink])).cards[0];

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      const sql1 = buildCardsLoadSql(
        { cards: [withSinks], hostnames: [] },
        loadSqlOptions({ cards: [withSinks], hostnames: [] }),
      );
      for (const statement of splitSqlStatements(sql1)) {
        await db.prepare(statement).run();
      }
      let sinks = await repo.listLeadSinks((await repo.getBySlug(card.slug))!.id);
      expect(sinks).toHaveLength(1);

      const sql2 = buildCardsLoadSql(
        { cards: [card], hostnames: [] },
        loadSqlOptions({ cards: [card], hostnames: [] }),
      );
      for (const statement of splitSqlStatements(sql2)) {
        await db.prepare(statement).run();
      }
      sinks = await repo.listLeadSinks((await repo.getBySlug(card.slug))!.id);
      expect(sinks).toHaveLength(1);
    });
  });

  it("deletes sinks when leadSinks is an empty array", async () => {
    const withSinks = parseCardsLoadFile(cardWithSinks([accountEmailSink])).cards[0];
    const empty = parseCardsLoadFile(cardWithSinks([])).cards[0];

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      const loadFile = { cards: [withSinks], hostnames: [] };
      const sql1 = buildCardsLoadSql(loadFile, loadSqlOptions(loadFile));
      for (const statement of splitSqlStatements(sql1)) {
        await db.prepare(statement).run();
      }
      const card = await repo.getBySlug(withSinks.slug);
      expect(await repo.listLeadSinks(card!.id)).toHaveLength(1);

      const sql2 = buildCardsLoadSql(
        { cards: [empty], hostnames: [] },
        loadSqlOptions({ cards: [empty], hostnames: [] }),
      );
      for (const statement of splitSqlStatements(sql2)) {
        await db.prepare(statement).run();
      }
      expect(await repo.listLeadSinks(card!.id)).toHaveLength(0);
    });
  });
});

describe("non-prod email sink destination guard", () => {
  it("passes when email sinks use account_email", () => {
    const file = parseCardsLoadFile(cardWithSinks([accountEmailSink]));
    expect(() => validateNonProdEmailSinkDestinations(file, "")).not.toThrow();
  });

  it("passes with env unset when the file has no email sinks", () => {
    const file = parseCardsLoadFile(exampleLoadRaw());
    expect(() => validateNonProdEmailSinkDestinations(file, "")).not.toThrow();
  });
});
