import { afterEach, describe, expect, it, vi } from "vitest";
import { editorPublishedCardUrl } from "@/config/editor-published-card-url";

describe("editorPublishedCardUrl (unit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the production card host for production builds", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    expect(editorPublishedCardUrl("ada")).toBe("https://we-met.link/hi/ada");
  });

  it("uses WE_MET_BASE_URL on staging builds", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_WE_MET_BASE_URL", "https://we-met.didi.build");
    expect(editorPublishedCardUrl("ada")).toBe("https://we-met.didi.build/hi/ada");
  });
});
