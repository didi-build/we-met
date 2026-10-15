import { describe, expect, it } from "vitest";
import {
  appSpaPath,
  isAppApiServingHost,
  resolveAppOrigin,
} from "@/config/app-api-host";
import { readWeMetHostConfig } from "@/config/we-met";

describe("app API host helpers (unit)", () => {
  const production = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "production",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
  });

  const preview = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "preview",
    WE_MET_PREVIEW_HOST_SUFFIX: "-we-met.example.workers.dev",
  });

  const local = readWeMetHostConfig({
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "local",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
  });

  it("allows app, preview, and local hosts for app API routes", () => {
    expect(isAppApiServingHost("app.we-met.link", production)).toBe(true);
    expect(isAppApiServingHost("we-met.link", production)).toBe(false);
    expect(isAppApiServingHost("pr-1-we-met.example.workers.dev", preview)).toBe(true);
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
      resolveAppOrigin(preview, "https://pr-1-we-met.example.workers.dev/app", {}),
    ).toBe("https://pr-1-we-met.example.workers.dev");
  });

  it("chooses SPA paths for redirect targets", () => {
    expect(appSpaPath(production, "app.we-met.link")).toBe("/");
    expect(appSpaPath(preview, "pr-1-we-met.example.workers.dev")).toBe("/app");
  });
});
