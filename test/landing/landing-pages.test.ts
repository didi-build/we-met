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
  it("marks / and /app-coming-soon as force-dynamic", () => {
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    const soon = readFileSync(
      join(process.cwd(), "src/app/app-coming-soon/page.tsx"),
      "utf8",
    );
    expect(home).toMatch(/export const dynamic = "force-dynamic"/);
    expect(soon).toMatch(/export const dynamic = "force-dynamic"/);
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
