import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readLandingHostConfig } from "@/lib/landing/server-config";

const { getCloudflareContext } = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext,
}));

describe("landing pages (regression)", () => {
  it("marks marketing routes as force-dynamic", () => {
    const paths = [
      "src/app/page.tsx",
      "src/app/app-coming-soon/page.tsx",
      "src/app/privacy/page.tsx",
      "src/app/terms/page.tsx",
    ];
    for (const relativePath of paths) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(source).toMatch(/export const dynamic = "force-dynamic"/);
    }
  });

  it("reads host config from Worker env at request time", async () => {
    getCloudflareContext.mockResolvedValue({
      env: {
        WE_MET_BASE_URL: "https://preview.example.workers.dev",
        WE_MET_ENV: "preview",
        WE_MET_PREVIEW_HOST_SUFFIX: "-example.workers.dev",
      },
    });

    const config = await readLandingHostConfig();
    expect(config.baseUrl).toBe("https://preview.example.workers.dev");
    expect(getCloudflareContext).toHaveBeenCalledWith({ async: true });
  });
});
