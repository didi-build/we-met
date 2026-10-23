import { describe, expect, it } from "vitest";
import {
  buildVcardFormRedirectLocation,
  normalizeVcardFormSlug,
  vcardFormErrorToRedirectReason,
} from "@/exchange/vcard-form-redirect";

describe("vcardFormErrorToRedirectReason (unit)", () => {
  it("maps session-ending errors to expired", () => {
    expect(vcardFormErrorToRedirectReason("invalid_token")).toBe("expired");
    expect(vcardFormErrorToRedirectReason("card_not_found")).toBe("expired");
    expect(vcardFormErrorToRedirectReason("invalid_input")).toBe("expired");
    expect(vcardFormErrorToRedirectReason("invalid_host")).toBe("expired");
  });

  it("maps transient errors to limited", () => {
    expect(vcardFormErrorToRedirectReason("rate_limited")).toBe("limited");
    expect(vcardFormErrorToRedirectReason("server_error")).toBe("limited");
  });
});

describe("buildVcardFormRedirectLocation (unit)", () => {
  it("builds a relative hi path for a valid slug", () => {
    expect(buildVcardFormRedirectLocation("vcard-test", "expired")).toBe(
      "/hi/vcard-test?vcard=expired",
    );
    expect(buildVcardFormRedirectLocation("vcard-test", "limited")).toBe(
      "/hi/vcard-test?vcard=limited",
    );
  });

  it("rejects open-redirect style slugs", () => {
    expect(buildVcardFormRedirectLocation("https://evil.test", "expired")).toBe("/");
    expect(buildVcardFormRedirectLocation("//evil.test", "expired")).toBe("/");
    expect(buildVcardFormRedirectLocation("%2Fevil", "expired")).toBe("/");
    expect(buildVcardFormRedirectLocation("../other", "expired")).toBe("/");
    expect(buildVcardFormRedirectLocation("", "limited")).toBe("/");
    expect(buildVcardFormRedirectLocation("bad slug", "limited")).toBe("/");
  });
});

describe("normalizeVcardFormSlug (unit)", () => {
  it("accepts valid slugs only", () => {
    expect(normalizeVcardFormSlug("didi")).toBe("didi");
    expect(normalizeVcardFormSlug("  didi  ")).toBe("didi");
    expect(normalizeVcardFormSlug("//host")).toBeUndefined();
  });
});
