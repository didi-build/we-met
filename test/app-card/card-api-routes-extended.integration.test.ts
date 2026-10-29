import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cardGet } from "@/app/api/app/card/route";
import { PUT as draftPut } from "@/app/api/app/card/draft/route";
import { POST as publishPost } from "@/app/api/app/card/publish/route";
import { GET as slugCheckGet } from "@/app/api/app/slug-check/route";
import { GET as photoGet, POST as photoPost } from "@/app/api/app/photo/route";
import { SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { createSession } from "@/app-auth/sessions";
import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: routeMocks.env })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => {
    const headers = new Headers();
    for (const [key, value] of routeMocks.headerMap.entries()) {
      headers.set(key, value);
    }
    return headers;
  }),
}));

vi.mock("@/images/ingest-card-photo", () => ({
  ingestCardPhotoFromRequest: vi.fn(async () => ({
    ok: true,
    key: "a".repeat(64),
    size: 4,
  })),
}));

function setRequestHeaders(init: Record<string, string>) {
  routeMocks.headerMap.clear();
  for (const [key, value] of Object.entries(init)) {
    routeMocks.headerMap.set(key.toLowerCase(), value);
  }
}

function mutationHeaders(origin = "http://localhost:3000"): HeadersInit {
  return {
    origin,
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
  };
}

function baseCard(overrides: Record<string, unknown> = {}) {
  return {
    slug: "valid-slug",
    name: "Owner",
    role: "",
    photo: "",
    about: [],
    services: [],
    links: { website: "https://example.com", linkedin: "", github: "", instagram: "" },
    alternate: { url: "", label: "" },
    ...overrides,
  };
}

async function seedActiveAccount(db: D1Database, id: string) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
       VALUES (?, ?, 'owner@example.com', 'Owner', 'active', ?, ?)`,
    )
    .bind(id, `sub-${id}`, now, now)
    .run();
  return createSession(db, id);
}

describe("app card API routes extended (integration)", () => {
  beforeEach(() => {
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      WE_MET_ASSETS: {
        head: vi.fn(async () => ({
          httpMetadata: { contentType: CARD_PHOTO_JPEG_CONTENT_TYPE },
        })),
        put: vi.fn(),
        get: vi.fn(async () => ({
          body: new ReadableStream(),
          size: 1,
          httpMetadata: { contentType: CARD_PHOTO_JPEG_CONTENT_TYPE },
        })),
      },
      IMAGES: {},
    };
    setRequestHeaders({
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    });
  });

  it("returns 400 for malformed JSON on draft save", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const session = await seedActiveAccount(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await draftPut(
        new Request("http://localhost:3000/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: "{not-json",
        }),
      );
      expect(response.status).toBe(400);
    });
  });

  it("saves draft with short slug and http link; publish rejects both", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const session = await seedActiveAccount(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const draftBody = baseCard({
        slug: "ab",
        links: { website: "http://x", linkedin: "", github: "", instagram: "" },
      });
      const draftRes = await draftPut(
        new Request("http://localhost:3000/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: draftBody }),
        }),
      );
      expect(draftRes.status).toBe(200);

      const publishRes = await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: draftBody }),
        }),
      );
      expect(publishRes.status).toBe(422);
    });
  });

  it("allows publish with ten services", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const session = await seedActiveAccount(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const services = Array.from({ length: 10 }, (_, i) => ({
        title: `S${i}`,
        description: "d",
      }));
      const response = await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ slug: "ten-services", services }) }),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { url: string };
      expect(body.url).toMatch(/https?:\/\/localhost:3000\/hi\/ten-services$/);
    });
  });

  it("returns slug-taken when another account owns the slug", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('other', 'sub2', 'other@example.com', 'Other', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();
      await db
        .prepare(
          `INSERT INTO cards (
            id, slug, variant, display_name, account_id, status, photo_key,
            links_json, page_copy_json, contact_json, copy_json, updated_at
          ) VALUES (
            'c-other', 'taken-slug', 'mono', 'Other', 'other', 'live', NULL,
            '{}', '{}', '{}', '{}', ?
          )`,
        )
        .bind(now)
        .run();
      const session = await seedActiveAccount(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ slug: "taken-slug" }) }),
        }),
      );
      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("slug-taken");
    });
  });

  it("returns slug-locked when changing slug after publish", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const session = await seedActiveAccount(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ slug: "locked-slug" }) }),
        }),
      );
      const response = await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ slug: "new-slug" }) }),
        }),
      );
      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("slug-locked");
    });
  });

  it("returns 403 for suspended accounts on every card route", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'suspended', ?, ?)`,
        )
        .bind(now, now)
        .run();
      const session = await createSession(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });

      expect((await cardGet()).status).toBe(403);
      expect(
        (
          await slugCheckGet(
            new Request("http://localhost:3000/api/app/slug-check?slug=x"),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await draftPut(
            new Request("http://localhost:3000/api/app/card/draft", {
              method: "PUT",
              headers: mutationHeaders(),
              body: JSON.stringify({ card: baseCard() }),
            }),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await publishPost(
            new Request("http://localhost:3000/api/app/card/publish", {
              method: "POST",
              headers: mutationHeaders(),
              body: JSON.stringify({ card: baseCard() }),
            }),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await photoPost(
            new Request("http://localhost:3000/api/app/photo", {
              method: "POST",
              headers: {
                ...mutationHeaders(),
                "content-type": "image/jpeg",
              },
              body: new Uint8Array([0xff, 0xd8]),
            }),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await photoGet(
            new Request(`http://localhost:3000/api/app/photo?v=${"a".repeat(64)}`),
          )
        ).status,
      ).toBe(403);
    });
  });

  it("serves draft photo only to the owner", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const key = "b".repeat(64);
      const session = await seedActiveAccount(db, "a1");
      const other = await seedActiveAccount(db, "a2");
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
           VALUES ('a1', '{}', ?, ?)`,
        )
        .bind(key, now)
        .run();

      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${other.token}`,
      });
      expect(
        (await photoGet(new Request(`http://localhost:3000/api/app/photo?v=${key}`)))
          .status,
      ).toBe(404);

      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const owned = await photoGet(
        new Request(`http://localhost:3000/api/app/photo?v=${key}`),
      );
      expect(owned.status).toBe(200);
    });
  });

  it("stores photo key from upload in card_drafts", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const session = await seedActiveAccount(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: {
            ...mutationHeaders(),
            "content-type": "image/jpeg",
          },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );
      expect(response.status).toBe(200);
      const row = await db
        .prepare("SELECT photo_key FROM card_drafts WHERE account_id = 'a1'")
        .first<{ photo_key: string }>();
      expect(row?.photo_key).toBe("a".repeat(64));
    });
  });
});
