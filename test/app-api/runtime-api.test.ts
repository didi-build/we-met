// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  http: { transport: "http" as const },
  stub: { transport: "stub" as const },
}));

vi.mock("@/app-api/http-api", () => ({
  createHttpApi: vi.fn(() => apiMocks.http),
}));

vi.mock("@/app-api/stub-api", () => ({
  createStubApi: vi.fn(() => apiMocks.stub),
}));

import { createRuntimeAppApi } from "@/app-api/runtime-api";

describe("createRuntimeAppApi (unit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the HTTP API on production", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    expect(createRuntimeAppApi()).toBe(apiMocks.http);
  });

  it("uses the HTTP API on staging", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    expect(createRuntimeAppApi()).toBe(apiMocks.http);
  });

  it("uses the stub API for unknown client env values", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "unknown");
    expect(createRuntimeAppApi()).toBe(apiMocks.stub);
  });
});
