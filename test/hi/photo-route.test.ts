import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveCardForRequest, getAssetStorage } = vi.hoisted(() => ({
  resolveCardForRequest: vi.fn(),
  getAssetStorage: vi.fn(),
}));

vi.mock("@/card-data/server", () => ({
  resolveCardForRequest,
}));

vi.mock("@/assets/get-storage", () => ({
  getAssetStorage,
}));

import { GET } from "@/app/hi/[slug]/photo.jpg/route";

describe("photo route (unit)", () => {
  beforeEach(() => {
    resolveCardForRequest.mockReset();
    getAssetStorage.mockReset();
  });

  it("returns 404 for unknown slug", async () => {
    resolveCardForRequest.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/hi/unknown/photo.jpg"), {
      params: Promise.resolve({ slug: "unknown" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 when photoKey is null", async () => {
    resolveCardForRequest.mockResolvedValue({
      slug: "demo",
      photoKey: null,
    });
    const response = await GET(new Request("http://localhost/hi/demo/photo.jpg"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 when object is missing in storage", async () => {
    resolveCardForRequest.mockResolvedValue({
      slug: "demo",
      photoKey: "cards/demo/abc.jpg",
    });
    getAssetStorage.mockResolvedValue({
      getObject: async () => null,
    });
    const response = await GET(new Request("http://localhost/hi/demo/photo.jpg"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    expect(response.status).toBe(404);
  });

  it("ignores key query parameters", async () => {
    resolveCardForRequest.mockResolvedValue({
      slug: "demo",
      photoKey: "cards/demo/abc.jpg",
    });
    const response = await GET(
      new Request("http://localhost/hi/demo/photo.jpg?key=evil"),
      { params: Promise.resolve({ slug: "demo" }) },
    );
    expect(response.status).toBe(404);
    expect(getAssetStorage).not.toHaveBeenCalled();
  });

  it("streams object with immutable cache headers", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    resolveCardForRequest.mockResolvedValue({
      slug: "demo",
      photoKey: "cards/demo/abc.jpg",
    });
    getAssetStorage.mockResolvedValue({
      getObject: async () => ({
        body,
        contentType: "image/jpeg",
        size: 3,
      }),
    });
    const response = await GET(new Request("http://localhost/hi/demo/photo.jpg"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  });
});
