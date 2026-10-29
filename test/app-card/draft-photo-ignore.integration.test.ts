import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT as draftPut } from "@/app/api/app/card/draft/route";
import {
  GET as photoGet,
  DELETE as photoDelete,
  POST as photoPost,
} from "@/app/api/app/photo/route";
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
    key: "e".repeat(64),
    size: 4,
  })),
}));

function mutationHeaders(): HeadersInit {
  return {
    origin: "http://localhost:3000",
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
  };
}

describe("draft PUT ignores photo key (integration)", () => {
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
        get: vi.fn(async () => ({
          body: new ReadableStream(),
          size: 1,
          httpMetadata: { contentType: CARD_PHOTO_JPEG_CONTENT_TYPE },
        })),
      },
      IMAGES: {},
    };
    routeMocks.headerMap.set("host", "localhost:3000");
    routeMocks.headerMap.set("x-forwarded-proto", "http");
  });

  async function seedSession(db: D1Database) {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
         VALUES ('a1', 'sub-a1', 'owner@example.com', 'Owner', 'active', ?, ?)`,
      )
      .bind(now, now)
      .run();
    const session = await createSession(db, "a1");
    routeMocks.headerMap.set("cookie", `${SESSION_COOKIE_NAME}=${session.token}`);
  }

  const staleCard = {
    slug: "stale",
    name: "Old",
    role: "",
    photo: "",
    about: [],
    services: [],
    links: { website: "", linkedin: "", github: "", instagram: "" },
    alternate: { url: "", label: "" },
  };

  it("keeps photo_key after draft PUT with empty photo and stale body", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await seedSession(db);
      const key = "e".repeat(64);

      await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: { ...mutationHeaders(), "content-type": "image/jpeg" },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );

      const draftRes = await draftPut(
        new Request("http://localhost:3000/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: staleCard }),
        }),
      );
      expect(draftRes.status).toBe(200);

      const row = await db
        .prepare("SELECT photo_key FROM card_drafts WHERE account_id = 'a1'")
        .first<{ photo_key: string }>();
      expect(row?.photo_key).toBe(key);

      const photoRes = await photoGet(
        new Request(`http://localhost:3000/api/app/photo?v=${key}`),
      );
      expect(photoRes.status).toBe(200);
    });
  });

  it("DELETE clears photo_key; GET photo is 404; DELETE is idempotent", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await seedSession(db);
      const key = "e".repeat(64);

      await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: { ...mutationHeaders(), "content-type": "image/jpeg" },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );

      const del1 = await photoDelete(
        new Request("http://localhost:3000/api/app/photo", {
          method: "DELETE",
          headers: mutationHeaders(),
        }),
      );
      expect(del1.status).toBe(200);

      const del2 = await photoDelete(
        new Request("http://localhost:3000/api/app/photo", {
          method: "DELETE",
          headers: mutationHeaders(),
        }),
      );
      expect(del2.status).toBe(200);

      const row = await db
        .prepare("SELECT photo_key FROM card_drafts WHERE account_id = 'a1'")
        .first<{ photo_key: string | null }>();
      expect(row?.photo_key).toBeNull();

      const photoRes = await photoGet(
        new Request(`http://localhost:3000/api/app/photo?v=${key}`),
      );
      expect(photoRes.status).toBe(404);
    });
  });

  it("rejects unauthenticated DELETE", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      routeMocks.headerMap.delete("cookie");
      const response = await photoDelete(
        new Request("http://localhost:3000/api/app/photo", {
          method: "DELETE",
          headers: mutationHeaders(),
        }),
      );
      expect(response.status).toBe(401);
    });
  });
});
