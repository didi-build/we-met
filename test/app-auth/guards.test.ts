import { describe, expect, it } from "vitest";
import {
  assertAppApiHost,
  checkContentType,
  checkOriginForMutation,
  checkSecFetchSite,
  guardMutationRequest,
} from "@/app-auth/guards";
import { readWeMetHostConfig } from "@/config/we-met";

describe("app auth guards (unit)", () => {
  const production = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "production",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
  });

  it("returns 404 host guard on production card host", () => {
    expect(assertAppApiHost("we-met.link", production)).toBe(false);
    expect(assertAppApiHost("app.we-met.link", production)).toBe(true);
  });

  it("allows app API routes on the staging single host", () => {
    const staging = readWeMetHostConfig({
      WE_MET_BASE_URL: "https://we-met.didi.build",
      WE_MET_ENV: "staging",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
    });
    expect(assertAppApiHost("we-met.didi.build", staging)).toBe(true);
    expect(assertAppApiHost("app.we-met.didi.build", staging)).toBe(false);
  });

  it("rejects missing, null, and wrong Origin on mutations", () => {
    const env = { WE_MET_APP_ORIGIN: "http://localhost:3000" };
    const local = readWeMetHostConfig({
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
    });
    const base = "http://localhost:3000/api/auth/logout";
    expect(
      checkOriginForMutation(new Request(base, { method: "POST" }), local, env),
    ).toBe(false);
    expect(
      checkOriginForMutation(
        new Request(base, { method: "POST", headers: { origin: "null" } }),
        local,
        env,
      ),
    ).toBe(false);
    expect(
      checkOriginForMutation(
        new Request(base, {
          method: "POST",
          headers: { origin: "http://evil.example" },
        }),
        local,
        env,
      ),
    ).toBe(false);
    expect(
      checkOriginForMutation(
        new Request(base, {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        }),
        local,
        env,
      ),
    ).toBe(true);
  });

  it("enforces content type and sec-fetch-site", () => {
    expect(
      checkContentType(
        new Request("http://x", {
          headers: { "content-type": "text/plain" },
        }),
        "application/json",
      ),
    ).toBe(false);
    expect(
      checkSecFetchSite(
        new Request("http://x", { headers: { "sec-fetch-site": "cross-site" } }),
      ),
    ).toBe(false);
    const blocked = guardMutationRequest(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
      }),
      readWeMetHostConfig({
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "local",
      }),
      { WE_MET_APP_ORIGIN: "http://localhost:3000" },
      "application/json",
    );
    expect(blocked).toBeNull();
  });
});
