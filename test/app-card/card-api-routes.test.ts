import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cardGet } from "@/app/api/app/card/route";
import { PUT as draftPut } from "@/app/api/app/card/draft/route";
import { GET as slugCheckGet } from "@/app/api/app/slug-check/route";
import { POST as publishPost } from "@/app/api/app/card/publish/route";
import { SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { createSession } from "@/app-auth/sessions";
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

describe("app card API routes (integration)", () => {
  beforeEach(() => {
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
    };
    setRequestHeaders({ host: "localhost:3000" });
  });

  it("returns 403 for suspended accounts on card routes", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a-susp', 'sub-susp', 'owner@example.com', 'Owner', 'suspended', ?, ?)`,
        )
        .bind(now, now)
        .run();
      const session = await createSession(db, "a-susp");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await draftPut(
        new Request("http://localhost/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: JSON.stringify({ slug: "", name: "X" }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  it("returns 403 for waitlisted accounts on card routes", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'waitlisted', ?, ?)`,
        )
        .bind(now, now)
        .run();
      const session = await createSession(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await cardGet();
      expect(response.status).toBe(403);
    });
  });

  it("slug-check treats owner published slug as available", async () => {
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
      await db
        .prepare(
          `INSERT INTO cards (
            id, slug, variant, display_name, account_id, status, photo_key,
            links_json, page_copy_json, contact_json, copy_json, updated_at
          ) VALUES (
            'c1', 'mine-slug', 'mono', 'Owner', 'a1', 'live', NULL,
            '{}', '{"name":"Owner"}', '{}', '{}', ?
          )`,
        )
        .bind(now)
        .run();
      const session = await createSession(db, "a1");
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await slugCheckGet(
        new Request("http://localhost:3000/api/app/slug-check?slug=mine-slug"),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("available");
    });
  });

  it("publish rejects 11 services with invalid-fields", async () => {
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
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const services = Array.from({ length: 11 }, (_, i) => ({
        title: `S${i}`,
        description: "x",
      }));
      const response = await publishPost(
        new Request("http://localhost:3000/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({
            card: {
              slug: "valid-slug",
              name: "Owner",
              role: "",
              photo: "",
              about: [],
              services,
              links: { website: "", linkedin: "", github: "", instagram: "" },
              alternate: { url: "", label: "" },
            },
          }),
        }),
      );
      expect(response.status).toBe(422);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("invalid-fields");
    });
  });

  it("blocks mutating routes without Origin", async () => {
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
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await draftPut(
        new Request("http://localhost:3000/api/app/card/draft", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            card: {
              slug: "",
              name: "",
              role: "",
              photo: "",
              about: [],
              services: [],
              links: { website: "", linkedin: "", github: "", instagram: "" },
              alternate: { url: "", label: "" },
            },
          }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });
});
