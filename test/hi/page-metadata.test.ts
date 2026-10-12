import { describe, expect, it } from "vitest";
import { exampleCardInput } from "../helpers/example-card";
import { absoluteUrl } from "@/config/we-met";
import { resolveHiCardMetadata } from "@/lib/hi/page-metadata";

describe("resolveHiCardMetadata", () => {
  it("uses an absolute canonical URL from WE_MET_BASE_URL", () => {
    const card = exampleCardInput();
    const hostConfig = {
      baseUrl: "https://we-met.link",
      previewHostSuffix: null,
      weMetEnv: "production",
    };
    const metadata = resolveHiCardMetadata(
      { ...card, id: "id", slug: "demo", updatedAt: "2026-01-01T00:00:00Z" },
      hostConfig,
    );
    const expected = absoluteUrl(hostConfig.baseUrl, "/hi/demo");
    expect(metadata.alternates?.canonical).toBe(expected);
    expect(metadata.openGraph?.url).toBe(expected);
  });
});
