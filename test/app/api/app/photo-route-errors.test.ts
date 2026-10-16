import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE as photoDelete,
  GET as photoGet,
  POST as photoPost,
} from "@/app/api/app/photo/route";
import { SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { createSession } from "@/app-auth/sessions";
import { withIsolatedLocalD1 } from "../../../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
}));

const ingestMocks = vi.hoisted(() => ({
  ingestCardPhotoFromRequest: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  clearDraftPhotoKey: vi.fn(),
  realClearDraftPhotoKey: null as
    | ((
        db: import("@cloudflare/workers-types").D1Database,
        accountId: string,
      ) => Promise<void>)
    | null,
}));

const assetMocks = vi.hoisted(() => ({
  getAssetStorage: vi.fn(),
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
  ingestCardPhotoFromRequest: ingestMocks.ingestCardPhotoFromRequest,
}));

vi.mock("@/app-card/card-store", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/app-card/card-store")>();
  storeMocks.realClearDraftPhotoKey = mod.clearDraftPhotoKey;
  storeMocks.clearDraftPhotoKey.mockImplementation(mod.clearDraftPhotoKey);
  return {
    ...mod,
    clearDraftPhotoKey: (
      db: import("@cloudflare/workers-types").D1Database,
      accountId: string,
    ) => storeMocks.clearDraftPhotoKey(db, accountId),
  };
});

vi.mock("@/assets/get-storage", () => ({
  getAssetStorage: () => assetMocks.getAssetStorage(),
}));

describe("POST /api/app/photo errors (integration)", () => {
  beforeEach(() => {
    ingestMocks.ingestCardPhotoFromRequest.mockReset();
    storeMocks.clearDraftPhotoKey.mockReset();
    if (storeMocks.realClearDraftPhotoKey) {
      storeMocks.clearDraftPhotoKey.mockImplementation(
        storeMocks.realClearDraftPhotoKey,
      );
    }
    assetMocks.getAssetStorage.mockReset();
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      WE_MET_ASSETS: {},
      IMAGES: {},
    };
    routeMocks.headerMap.set("host", "localhost:3000");
  });

  it("returns 503 unavailable JSON on unexpected errors", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();
      const session = await createSession(db, "a1");
      routeMocks.headerMap.set("cookie", `${SESSION_COOKIE_NAME}=${session.token}`);

      ingestMocks.ingestCardPhotoFromRequest.mockRejectedValue(new Error("boom"));

      const response = await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "image/jpeg",
            "sec-fetch-site": "same-origin",
          },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unavailable");
      expect(JSON.stringify(body)).not.toContain("boom");
    });
  });
});

const PHOTO_KEY = "a".repeat(64);

async function seedSession(db: import("@cloudflare/workers-types").D1Database) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
       VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', ?, ?)`,
    )
    .bind(now, now)
    .run();
  const session = await createSession(db, "a1");
  routeMocks.headerMap.set("cookie", `${SESSION_COOKIE_NAME}=${session.token}`);
}

describe("DELETE /api/app/photo errors (integration)", () => {
  beforeEach(() => {
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      WE_MET_ASSETS: {},
      IMAGES: {},
    };
    routeMocks.headerMap.set("host", "localhost:3000");
  });

  it("returns 503 unavailable JSON on unexpected errors", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await seedSession(db);
      storeMocks.clearDraftPhotoKey.mockRejectedValue(new Error("boom"));

      const response = await photoDelete(
        new Request("http://localhost:3000/api/app/photo", {
          method: "DELETE",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
            "sec-fetch-site": "same-origin",
          },
        }),
      );
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unavailable");
    });
  });
});

describe("GET /api/app/photo errors (integration)", () => {
  beforeEach(() => {
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      WE_MET_ASSETS: {},
      IMAGES: {},
    };
    routeMocks.headerMap.set("host", "localhost:3000");
  });

  it("returns 503 unavailable JSON on unexpected errors", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await seedSession(db);
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO card_drafts (account_id, draft_json, photo_key, updated_at)
           VALUES ('a1', '{}', ?, ?)`,
        )
        .bind(PHOTO_KEY, now)
        .run();

      assetMocks.getAssetStorage.mockRejectedValue(new Error("boom"));

      const response = await photoGet(
        new Request(`http://localhost:3000/api/app/photo?v=${PHOTO_KEY}`, {
          method: "GET",
          headers: { "sec-fetch-site": "same-origin" },
        }),
      );
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unavailable");
    });
  });
});
