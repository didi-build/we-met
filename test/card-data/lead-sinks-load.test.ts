import { describe, expect, it } from "vitest";
import {
  parseCardsLoadFile,
  validateNonProdEmailSinkDestinations,
} from "@/card-data/load-file";
import { buildCardsLoadSql, newCardIdsForLoad } from "@/card-data/load-sql";
import { splitSqlStatements } from "@/card-data/sql-statements";
import { D1CardRepository } from "@/card-data/d1-repository";
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

describe("leadSinks load file (unit)", () => {
  it("accepts a valid email sink", () => {
    const file = parseCardsLoadFile(
      cardWithSinks([
        { id: "inbox-a", kind: "email", config: { to: "owner@example.com" } },
      ]),
    );
    expect(file.cards[0].leadSinks).toHaveLength(1);
  });

  it("loads several email sinks including duplicate to addresses", () => {
    const file = parseCardsLoadFile(
      cardWithSinks([
        { id: "inbox-a", kind: "email", config: { to: "same@example.com" } },
        { id: "inbox-b", kind: "email", config: { to: "same@example.com" } },
      ]),
    );
    expect(file.cards[0].leadSinks).toHaveLength(2);
  });

  it("rejects unknown kinds", () => {
    expect(() =>
      parseCardsLoadFile(cardWithSinks([{ id: "x", kind: "linear", config: {} }])),
    ).toThrow(/Unknown lead sink kind/);
  });

  it("rejects invalid to addresses and extra config keys", () => {
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([{ id: "bad", kind: "email", config: { to: "not an email" } }]),
      ),
    ).toThrow(/single email/);
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          { id: "bad2", kind: "email", config: { to: "a@b.com", extra: true } },
        ]),
      ),
    ).toThrow(/Unexpected field/);
  });

  it("rejects duplicate sink ids and invalid ids", () => {
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          { id: "dup", kind: "email", config: { to: "a@example.com" } },
          { id: "dup", kind: "email", config: { to: "b@example.com" } },
        ]),
      ),
    ).toThrow(/Duplicate lead sink id/);
    expect(() =>
      parseCardsLoadFile(
        cardWithSinks([
          { id: "Bad-ID", kind: "email", config: { to: "a@example.com" } },
        ]),
      ),
    ).toThrow(/must match/);
  });

  it("enforces per-card caps", () => {
    const many = Array.from({ length: MAX_LEAD_SINKS_PER_CARD + 1 }, (_, i) => ({
      id: `sink-${i}`,
      kind: "email",
      config: { to: `u${i}@example.com` },
    }));
    expect(() => parseCardsLoadFile(cardWithSinks(many))).toThrow(
      new RegExp(`${MAX_LEAD_SINKS_PER_CARD}`),
    );

    const manyEmail = Array.from({ length: MAX_EMAIL_SINKS_PER_CARD + 1 }, (_, i) => ({
      id: `email-${i}`,
      kind: "email",
      config: { to: `u${i}@example.com` },
    }));
    expect(() => parseCardsLoadFile(cardWithSinks(manyEmail))).toThrow(
      new RegExp(`${MAX_EMAIL_SINKS_PER_CARD}`),
    );
  });

  it("rejects root-level leadSinks", () => {
    const raw = exampleLoadRaw() as Record<string, unknown>;
    raw.leadSinks = [];
    expect(() => parseCardsLoadFile(raw)).toThrow(/each card object/);
  });
});

describe("leadSinks load SQL reconcile (integration)", () => {
  it("leaves sinks untouched when leadSinks key is absent", async () => {
    const card = parseCardsLoadFile(exampleLoadRaw()).cards[0];
    const withSinks = parseCardsLoadFile(
      cardWithSinks([{ id: "keep", kind: "email", config: { to: "a@example.com" } }]),
    ).cards[0];

    const updatedAt = "2026-10-15T12:00:00.000Z";
    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      const sql1 = buildCardsLoadSql(
        { cards: [withSinks], hostnames: [] },
        {
          updatedAt,
          newCardIds: newCardIdsForLoad({ cards: [withSinks], hostnames: [] }),
        },
      );
      for (const statement of splitSqlStatements(sql1)) {
        await db.prepare(statement).run();
      }
      let sinks = await repo.listLeadSinks((await repo.getBySlug(card.slug))!.id);
      expect(sinks).toHaveLength(1);

      const sql2 = buildCardsLoadSql(
        { cards: [card], hostnames: [] },
        { updatedAt, newCardIds: newCardIdsForLoad({ cards: [card], hostnames: [] }) },
      );
      for (const statement of splitSqlStatements(sql2)) {
        await db.prepare(statement).run();
      }
      sinks = await repo.listLeadSinks((await repo.getBySlug(card.slug))!.id);
      expect(sinks).toHaveLength(1);
    });
  });

  it("deletes sinks when leadSinks is an empty array", async () => {
    const withSinks = parseCardsLoadFile(
      cardWithSinks([{ id: "gone", kind: "email", config: { to: "a@example.com" } }]),
    ).cards[0];
    const empty = parseCardsLoadFile(cardWithSinks([])).cards[0];
    const updatedAt = "2026-10-15T12:00:00.000Z";

    await withIsolatedLocalD1(async (db) => {
      const repo = new D1CardRepository(db);
      const loadFile = { cards: [withSinks], hostnames: [] };
      const sql1 = buildCardsLoadSql(loadFile, {
        updatedAt,
        newCardIds: newCardIdsForLoad(loadFile),
      });
      for (const statement of splitSqlStatements(sql1)) {
        await db.prepare(statement).run();
      }
      const card = await repo.getBySlug(withSinks.slug);
      expect(await repo.listLeadSinks(card!.id)).toHaveLength(1);

      const sql2 = buildCardsLoadSql(
        { cards: [empty], hostnames: [] },
        { updatedAt, newCardIds: newCardIdsForLoad({ cards: [empty], hostnames: [] }) },
      );
      for (const statement of splitSqlStatements(sql2)) {
        await db.prepare(statement).run();
      }
      expect(await repo.listLeadSinks(card!.id)).toHaveLength(0);
    });
  });
});

describe("non-prod email sink destination guard (unit)", () => {
  it("passes when all email sinks use the test inbox", () => {
    const file = parseCardsLoadFile(
      cardWithSinks([{ id: "a", kind: "email", config: { to: "test@example.com" } }]),
    );
    expect(() =>
      validateNonProdEmailSinkDestinations(file, "test@example.com"),
    ).not.toThrow();
  });

  it("fails when to mismatches or env is unset", () => {
    const file = parseCardsLoadFile(
      cardWithSinks([{ id: "a", kind: "email", config: { to: "other@example.com" } }]),
    );
    expect(() =>
      validateNonProdEmailSinkDestinations(file, "test@example.com"),
    ).toThrow(/WE_MET_TEST_MAIL_TO/);
    expect(() => validateNonProdEmailSinkDestinations(file, "")).toThrow(/must be set/);
  });
});
