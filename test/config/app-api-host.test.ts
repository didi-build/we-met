import { describe, expect, it } from "vitest";
import {
  appSpaPath,
  isAppApiServingHost,
  resolveAppOrigin,
} from "@/config/app-api-host";
import { isCardServingHost } from "@/config/we-met";
import type { WeMetHostConfig } from "@/config/we-met";
import { readWeMetHostConfig } from "@/config/we-met";

describe("app API host helpers (unit)", () => {
  const production = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "production",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
  });

  const preview = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.didi.build",
    WE_MET_ENV: "preview",
    WE_MET_PREVIEW_HOST_SUFFIX: "-we-met-preview.example.workers.dev",
  });

  const local = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "local",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
  });

  const staging = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.didi.build",
    WE_MET_ENV: "staging",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
  });

  it("accepts pr-42-we-met-preview workers.dev for card, app API, and OAuth origin", () => {
    const host = "pr-42-we-met-preview.example.workers.dev";
    expect(isCardServingHost(host, preview)).toBe(true);
    expect(isAppApiServingHost(host, preview)).toBe(true);
    expect(resolveAppOrigin(preview, `https://${host}/app`, {})).toBe(
      `https://${host}`,
    );
  });

  it("allows app, preview, and local hosts for app API routes", () => {
    expect(isAppApiServingHost("app.we-met.link", production)).toBe(true);
    expect(isAppApiServingHost("we-met.link", production)).toBe(false);
    expect(
      isAppApiServingHost("pr-1-we-met-preview.example.workers.dev", preview),
    ).toBe(true);
    expect(isAppApiServingHost("localhost", local)).toBe(true);
    expect(isAppApiServingHost("localhost", production)).toBe(false);
  });

  it("resolves app origin from config", () => {
    expect(
      resolveAppOrigin(production, "https://app.we-met.link/x", {
        WE_MET_APP_ORIGIN: "http://localhost:3000",
      }),
    ).toBe("https://app.we-met.link");
    expect(
      resolveAppOrigin(local, "http://localhost:3000/x", {
        WE_MET_APP_ORIGIN: "http://localhost:3000",
      }),
    ).toBe("http://localhost:3000");
    expect(
      resolveAppOrigin(
        preview,
        "https://pr-1-we-met-preview.example.workers.dev/app",
        {},
      ),
    ).toBe("https://pr-1-we-met-preview.example.workers.dev");
  });

  it("chooses SPA paths for redirect targets", () => {
    expect(appSpaPath(production, "app.we-met.link")).toBe("/");
    expect(appSpaPath(preview, "pr-1-we-met-preview.example.workers.dev")).toBe("/app");
  });

  it("staging uses the card host as the single app and API host", () => {
    expect(isAppApiServingHost("we-met.didi.build", staging)).toBe(true);
    expect(isAppApiServingHost("app.we-met.didi.build", staging)).toBe(false);
    expect(
      resolveAppOrigin(staging, "https://we-met.didi.build/app", {
        WE_MET_APP_ORIGIN: "http://localhost:3000",
      }),
    ).toBe("https://we-met.didi.build");
    expect(appSpaPath(staging, "we-met.didi.build")).toBe("/app");
  });

  it("staging resolveAppOrigin ignores an untrusted request host", () => {
    expect(
      resolveAppOrigin(staging, "https://evil.example/app", {
        WE_MET_APP_ORIGIN: "http://localhost:3000",
      }),
    ).toBe("https://we-met.didi.build");
  });

  it("resolveAppOrigin throws for an unknown env when using a hand-built config", () => {
    expect(() =>
      readWeMetHostConfig({
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "not-a-real-env",
      }),
    ).toThrow(/Invalid WE_MET_ENV/);
  });

  it("resolveAppOrigin prefers staging over preview suffix on the request host", () => {
    const handBuilt: WeMetHostConfig = {
      baseUrl: "https://we-met.didi.build",
      previewHostSuffix: "-we-met-preview.example.workers.dev",
      weMetEnv: "staging",
    };
    expect(
      resolveAppOrigin(
        handBuilt,
        "https://pr-99-we-met-preview.example.workers.dev/app",
        {},
      ),
    ).toBe("https://we-met.didi.build");
  });

  it("rejects staging configs that still carry a preview host suffix", () => {
    expect(() =>
      readWeMetHostConfig({
        WE_MET_BASE_URL: "https://we-met.didi.build",
        WE_MET_ENV: "staging",
        WE_MET_PREVIEW_HOST_SUFFIX: "-we-met-preview.example.workers.dev",
      }),
    ).toThrow(/WE_MET_PREVIEW_HOST_SUFFIX/);
  });

  it("production app host and OAuth origin are unchanged", () => {
    expect(isAppApiServingHost("we-met.link", production)).toBe(false);
    expect(isAppApiServingHost("app.we-met.link", production)).toBe(true);
    expect(
      resolveAppOrigin(production, "https://app.we-met.link/x", {
        WE_MET_APP_ORIGIN: "http://localhost:3000",
      }),
    ).toBe("https://app.we-met.link");
  });
});
