import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const ENV_KEYS = [
  "WE_MET_BASE_URL",
  "WE_MET_PREVIEW_HOST_SUFFIX",
  "WE_MET_ENV",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function request(path: string, host: string) {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

describe("landing middleware host routing (unit)", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    process.env.WE_MET_BASE_URL = "https://we-met.link";
    process.env.WE_MET_PREVIEW_HOST_SUFFIX = "-we-met.example.workers.dev";
    process.env.WE_MET_ENV = "production";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("rewrites app host / to the coming-soon page", () => {
    const response = middleware(request("/", "app.we-met.link"));
    expect(response?.headers.get("x-middleware-rewrite")).toMatch(/app-coming-soon/);
  });

  it("serves landing on we-met.link / without rewrite", () => {
    const response = middleware(request("/", "we-met.link"));
    expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response?.status).not.toBe(404);
  });

  it("returns 404 for /app-coming-soon on the card host", () => {
    const response = middleware(request("/app-coming-soon", "we-met.link"));
    expect(response?.status).toBe(404);
  });

  it("does not rewrite www or api hosts on /", () => {
    for (const host of ["www.we-met.link", "api.we-met.link"]) {
      const response = middleware(request("/", host));
      expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("keeps /hi/<slug> cache-control on app and card hosts", () => {
    for (const host of ["we-met.link", "app.we-met.link"]) {
      const response = middleware(request("/hi/didi", host));
      expect(response?.headers.get("cache-control")).toBe(
        "private, max-age=0, must-revalidate",
      );
    }
  });

  it("does not set card HTML cache-control on /hi photo or vcard assets", () => {
    const photo = middleware(request("/hi/didi/photo.jpg", "we-met.link"));
    expect(photo?.headers.get("cache-control")).toBeNull();

    const vcard = middleware(request("/hi/didi/contact.vcf", "we-met.link"));
    expect(vcard?.headers.get("cache-control")).toBeNull();
  });
});
