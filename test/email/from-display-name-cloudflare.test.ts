import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK,
  resolveCloudflareFromName,
} from "@/email/from-display-name";

describe("resolveCloudflareFromName (unit)", () => {
  it.each([
    ["undefined", undefined, CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK],
    ["empty", "", CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK],
    ["whitespace", "   \t  ", CLOUDFLARE_FROM_DISPLAY_NAME_FALLBACK],
    ["set", "  Demo Owner  ", "Demo Owner"],
  ])("resolves %s display name", (_label, input, expected) => {
    expect(resolveCloudflareFromName(input)).toBe(expected);
  });
});
