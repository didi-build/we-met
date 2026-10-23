import { describe, expect, it } from "vitest";
import { vcardIframeIndicatesApiError } from "@/lib/hi-card/vcard-form-download";

describe("vcardIframeIndicatesApiError (unit)", () => {
  it("detects JSON API error bodies", () => {
    expect(vcardIframeIndicatesApiError('{"error":"invalid_token"}')).toBe(true);
    expect(vcardIframeIndicatesApiError("BEGIN:VCARD")).toBe(false);
  });
});
