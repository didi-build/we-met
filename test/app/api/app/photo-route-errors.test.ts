import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as photoPost } from "@/app/api/app/photo/route";
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

describe("POST /api/app/photo errors (integration)", () => {
  beforeEach(() => {
    ingestMocks.ingestCardPhotoFromRequest.mockReset();
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
