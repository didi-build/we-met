import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/exchange/route";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: {} })),
}));

describe("POST /api/exchange honeypot (integration)", () => {
  it("returns an empty token without processing bots that fill the website field", async () => {
    const response = await POST(
      new Request("http://localhost/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "demo",
          name: "Bot",
          email: "bot@example.com",
          turnstileToken: "token",
          website: "https://spam.example",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "" });
  });
});
