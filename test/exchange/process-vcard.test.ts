import { describe, expect, it } from "vitest";
import { vcardDownloadRateLimitKey } from "@/exchange/process-vcard";

describe("vcardDownloadRateLimitKey", () => {
  it("namespaces vCard downloads separately from POST /api/exchange", () => {
    expect(vcardDownloadRateLimitKey("203.0.113.1")).toBe("vcard:203.0.113.1");
  });
});
