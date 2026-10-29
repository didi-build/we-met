import { publishCard, saveDraft } from "@/app-card/card-store";
import { PublishCardError } from "@/app-card/publish-errors";
import type { EditorCard } from "@/app-api/types";
import { describe, expect, it } from "vitest";
import { withIsolatedLocalD1 } from "../helpers/d1";

function validCard(overrides: Partial<EditorCard> = {}): EditorCard {
  return {
    slug: "my-card",
    name: "Owner",
    role: "Role",
    photo: "",
    about: [],
    services: Array.from({ length: 10 }, (_, i) => ({
      title: `Service ${i}`,
      description: "Desc",
    })),
    links: { website: "https://example.com", linkedin: "", github: "", instagram: "" },
    alternate: { url: "", label: "" },
    ...overrides,
  };
}

describe("publishCard (integration)", () => {
  it("does not create a second email sink on republish", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();

      await publishCard(db, "a1", validCard(), null);
      await publishCard(db, "a1", validCard({ role: "Updated" }), null);

      const sinks = await db
        .prepare("SELECT COUNT(*) AS n FROM lead_sinks")
        .first<{ n: number }>();
      expect(sinks?.n).toBe(1);
    });
  });

  it("returns forbidden when updating a suspended card without changing status", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();
      await publishCard(db, "a1", validCard(), null);
      await db
        .prepare("UPDATE cards SET status = 'suspended' WHERE account_id = 'a1'")
        .run();

      await expect(
        publishCard(db, "a1", validCard({ role: "Nope" }), null),
      ).rejects.toEqual(new PublishCardError("forbidden"));

      const row = await db
        .prepare("SELECT status, display_name FROM cards WHERE account_id = 'a1'")
        .first<{ status: string; display_name: string }>();
      expect(row?.status).toBe("suspended");
      expect(row?.display_name).toBe("Owner");
    });
  });

  it("updates an existing live card without inserting a duplicate row", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();

      await publishCard(db, "a1", validCard(), null);
      const result = await publishCard(
        db,
        "a1",
        validCard({ name: "After race" }),
        null,
      );
      expect(result.slug).toBe("my-card");
      const count = await db
        .prepare("SELECT COUNT(*) AS n FROM cards WHERE account_id = 'a1'")
        .first<{ n: number }>();
      expect(count?.n).toBe(1);
      const row = await db
        .prepare("SELECT display_name FROM cards WHERE account_id = 'a1'")
        .first<{ display_name: string }>();
      expect(row?.display_name).toBe("After race");
    });
  });

  it("resolves empty display name to the Google account name on publish", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Google Full Name', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();

      await publishCard(db, "a1", validCard({ name: "" }), null);

      const row = await db
        .prepare("SELECT display_name, contact_json FROM cards WHERE account_id = 'a1'")
        .first<{ display_name: string; contact_json: string }>();
      expect(row?.display_name).toBe("Google Full Name");
      const contact = JSON.parse(row!.contact_json) as {
        name: { full: string; nickname: string };
      };
      expect(contact.name.full).toBe("Google Full Name");
      expect(contact.name.nickname).toBe("");
    });
  });

  it("keeps a typed display name on publish", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Google Full Name', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();

      await publishCard(db, "a1", validCard({ name: "Card Nickname" }), null);

      const row = await db
        .prepare("SELECT display_name, contact_json FROM cards WHERE account_id = 'a1'")
        .first<{ display_name: string; contact_json: string }>();
      expect(row?.display_name).toBe("Card Nickname");
      const contact = JSON.parse(row!.contact_json) as {
        name: { full: string; nickname: string };
      };
      expect(contact.name.full).toBe("Google Full Name");
      expect(contact.name.nickname).toBe("Card Nickname");
    });
  });
});

describe("saveDraft (integration)", () => {
  it("does not change photo_key on saveDraft", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();
      const key = "a".repeat(64);
      await db
        .prepare(
          `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
           VALUES ('a1', '{}', ?, ?)`,
        )
        .bind(key, now)
        .run();

      await saveDraft(
        db,
        "a1",
        validCard({
          slug: "ab",
          links: { website: "http://x", linkedin: "", github: "", instagram: "" },
        }),
      );
      const row = await db
        .prepare(
          "SELECT draft_json, photo_key FROM card_drafts WHERE account_id = 'a1'",
        )
        .first<{ draft_json: string; photo_key: string | null }>();
      expect(row?.photo_key).toBe(key);
      const parsed = JSON.parse(row?.draft_json ?? "{}") as Record<string, unknown>;
      expect(parsed).not.toHaveProperty("photo");
    });
  });
});
