import { describe, expect, it } from "vitest";
import {
  isPreviewLoginRouteEnabled,
  previewLoginAllowed,
} from "@/app-auth/preview-login";

describe("preview login guard (unit)", () => {
  it("is enabled only on preview with a configured secret", () => {
    expect(previewLoginAllowed("preview", true)).toBe(true);
    expect(previewLoginAllowed("preview", false)).toBe(false);
    expect(previewLoginAllowed("production", true)).toBe(false);
    expect(previewLoginAllowed("local", true)).toBe(false);
    expect(previewLoginAllowed("staging", true)).toBe(false);
  });

  it("matches route helper", () => {
    expect(
      isPreviewLoginRouteEnabled({
        WE_MET_ENV: "preview",
        WE_MET_PREVIEW_LOGIN_SECRET: "secret",
      }),
    ).toBe(true);
    expect(
      isPreviewLoginRouteEnabled({
        WE_MET_ENV: "production",
        WE_MET_PREVIEW_LOGIN_SECRET: "secret",
      }),
    ).toBe(false);
    expect(
      isPreviewLoginRouteEnabled({
        WE_MET_ENV: "local",
        WE_MET_PREVIEW_LOGIN_SECRET: "secret",
      }),
    ).toBe(false);
    expect(
      isPreviewLoginRouteEnabled({
        WE_MET_ENV: "staging",
        WE_MET_PREVIEW_LOGIN_SECRET: "secret",
      }),
    ).toBe(false);
  });
});
