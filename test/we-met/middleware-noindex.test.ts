import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { NON_PRODUCTION_X_ROBOTS_TAG } from "@/lib/we-met/non-production";

const ENV_KEYS = [
  "WE_MET_BASE_URL",
  "WE_MET_PREVIEW_HOST_SUFFIX",
  "WE_MET_ENV",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function request(path: string, host: string) {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

describe("middleware non-production X-Robots-Tag (unit)", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    process.env.WE_MET_BASE_URL = "https://we-met.link";
    process.env.WE_MET_PREVIEW_HOST_SUFFIX = "-we-met.example.workers.dev";
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

  it("sets X-Robots-Tag for staging and preview", () => {
    for (const weMetEnv of ["staging", "preview"] as const) {
      process.env.WE_MET_ENV = weMetEnv;
      const landing = middleware(request("/", "we-met.link"));
      expect(landing?.headers.get("x-robots-tag")).toBe(NON_PRODUCTION_X_ROBOTS_TAG);

      const api = middleware(request("/api/exchange", "we-met.link"));
      expect(api?.headers.get("x-robots-tag")).toBe(NON_PRODUCTION_X_ROBOTS_TAG);
    }
  });

  it("does not set X-Robots-Tag in production", () => {
    process.env.WE_MET_ENV = "production";
    const landing = middleware(request("/", "we-met.link"));
    expect(landing?.headers.get("x-robots-tag")).toBeNull();

    const privacy = middleware(request("/privacy", "we-met.link"));
    expect(privacy?.headers.get("x-robots-tag")).toBeNull();
  });
});
