import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cardGet } from "@/app/api/app/card/route";
import { PUT as draftPut } from "@/app/api/app/card/draft/route";
import { POST as publishPost } from "@/app/api/app/card/publish/route";
import { POST as photoPost } from "@/app/api/app/photo/route";
import { SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { createSession } from "@/app-auth/sessions";
import { draftPhotoUrl } from "@/app-card/editor-persist";
import { createCardRepositoryFromD1 } from "@/card-data/get-repository";
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
    key: "d".repeat(64),
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

function baseCard(overrides: Record<string, unknown> = {}) {
  return {
    slug: "photo-life",
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

describe("photo draft lifecycle (integration)", () => {
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
      },
      IMAGES: {},
    };
    routeMocks.headerMap.set("host", "localhost:3000");
    routeMocks.headerMap.set("x-forwarded-proto", "http");
  });

  async function activeSession(db: D1Database) {
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
    return session;
  }

  it("returns a complete card after photo upload with no prior draft", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await activeSession(db);

      const upload = await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: {
            ...mutationHeaders(),
            "content-type": "image/jpeg",
          },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );
      expect(upload.status).toBe(200);

      const response = await cardGet();
      expect(response.status).toBe(200);
      const body = (await response.json()) as { draft: Record<string, unknown> };
      expect(body.draft).toMatchObject({
        slug: "",
        name: "",
        role: "",
        about: [],
        services: [],
        links: {
          website: "",
          linkedin: "",
          github: "",
          instagram: "",
        },
        alternate: { url: "", label: "" },
      });
      expect(body.draft.photo).toBe(draftPhotoUrl("d".repeat(64)));
    });
  });

  it("clears draft photo_key when save sends photo empty after upload", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await activeSession(db);

      await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: {
            ...mutationHeaders(),
            "content-type": "image/jpeg",
          },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );

      const save = await draftPut(
        new Request("http://localhost:3000/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ photo: "" }) }),
        }),
      );
      expect(save.status).toBe(200);

      const row = await db
        .prepare("SELECT photo_key FROM card_drafts WHERE account_id = 'a1'")
        .first<{ photo_key: string | null }>();
      expect(row?.photo_key).toBeNull();
    });
  });

  it("publish after photo removal stores NULL photo_key on the live card", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      await activeSession(db);

      await photoPost(
        new Request("http://localhost:3000/api/app/photo", {
          method: "POST",
          headers: {
            ...mutationHeaders(),
            "content-type": "image/jpeg",
          },
          body: new Uint8Array([0xff, 0xd8]),
        }),
      );

      await draftPut(
        new Request("http://localhost:3000/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ photo: "" }) }),
        }),
      );

      const publish = await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card: baseCard({ photo: "" }) }),
        }),
      );
      expect(publish.status).toBe(200);

      const cardRow = await db
        .prepare("SELECT photo_key FROM cards WHERE account_id = 'a1'")
        .first<{ photo_key: string | null }>();
      expect(cardRow?.photo_key).toBeNull();

      const repo = createCardRepositoryFromD1(db);
      const publicCard = await repo.getBySlug("photo-life");
      expect(publicCard?.photoKey).toBeNull();
    });
  });
});
