import { beforeEach, describe, expect, it, vi } from "vitest";

const { tryResolveHiCard, getAssetStorage } = vi.hoisted(() => ({
  tryResolveHiCard: vi.fn(),
  getAssetStorage: vi.fn(),
}));

vi.mock("@/lib/hi-card/resolve-card-route", () => ({
  tryResolveHiCard,
}));

vi.mock("@/assets/get-storage", () => ({
  getAssetStorage,
}));

import { GET } from "@/app/hi/[slug]/contact.vcf/route";
import { exampleCardInput } from "../helpers/example-card";

const NO_STORE = "no-store";

function jpegStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
      controller.close();
    },
  });
}

describe("vcard route (unit)", () => {
  beforeEach(() => {
    tryResolveHiCard.mockReset();
    getAssetStorage.mockReset();
  });

  it("returns 404 with no-store for unknown slug", async () => {
    tryResolveHiCard.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/hi/unknown/contact.vcf"), {
      params: Promise.resolve({ slug: "unknown" }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("omits PHOTO for a non-JPEG object", async () => {
    const card = exampleCardInput();
    tryResolveHiCard.mockResolvedValue({
      ...card,
      id: "id",
      slug: "demo",
      photoKey: "cards/demo/x.jpg",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    getAssetStorage.mockResolvedValue({
      getObject: async () => ({
        body: jpegStream(),
        contentType: "image/png",
        size: 3,
      }),
    });
    const response = await GET(new Request("http://localhost/hi/demo/contact.vcf"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toContain("PHOTO;");
  });

  it("includes PHOTO for a JPEG object", async () => {
    const card = exampleCardInput();
    tryResolveHiCard.mockResolvedValue({
      ...card,
      id: "id",
      slug: "demo",
      photoKey: "cards/demo/x.jpg",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    getAssetStorage.mockResolvedValue({
      getObject: async () => ({
        body: jpegStream(),
        contentType: "image/jpeg",
        size: 3,
      }),
    });
    const response = await GET(new Request("http://localhost/hi/demo/contact.vcf"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    const body = await response.text();
    expect(body).toContain("PHOTO;ENCODING=b;TYPE=JPEG:");
  });
});
