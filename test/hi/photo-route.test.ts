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

const NO_STORE = "no-store";
const IMMUTABLE = "public, max-age=31536000, immutable";

function jpegBody() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

describe("photo route (unit)", () => {
  beforeEach(() => {
    resolveCardForRequest.mockReset();
    getAssetStorage.mockReset();
  });

  it("returns 404 with no-store for unknown slug", async () => {
    resolveCardForRequest.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/hi/unknown/photo.jpg"), {
      params: Promise.resolve({ slug: "unknown" }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("returns 404 with no-store when photoKey is null", async () => {
    resolveCardForRequest.mockResolvedValue({
      slug: "demo",
      photoKey: null,
    });
    const response = await GET(new Request("http://localhost/hi/demo/photo.jpg"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("returns 404 with no-store when object is missing in storage", async () => {
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
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
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
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
    expect(getAssetStorage).not.toHaveBeenCalled();
  });

  it.each([
    ["text/html", "text/html"],
    ["image/png", "image/png"],
    ["image/svg+xml", "image/svg+xml"],
    ["application/octet-stream", "application/octet-stream"],
    ["missing", undefined],
  ])(
    "returns 404 with no-store for non-JPEG content type %s",
    async (_label, contentType) => {
      resolveCardForRequest.mockResolvedValue({
        slug: "demo",
        photoKey: "cards/demo/abc.jpg",
      });
      getAssetStorage.mockResolvedValue({
        getObject: async () => ({
          body: jpegBody(),
          contentType,
          size: 3,
        }),
      });
      const response = await GET(new Request("http://localhost/hi/demo/photo.jpg"), {
        params: Promise.resolve({ slug: "demo" }),
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
    },
  );

  it("streams JPEG with immutable cache and nosniff", async () => {
    resolveCardForRequest.mockResolvedValue({
      slug: "demo",
      photoKey: "cards/demo/abc.jpg",
    });
    getAssetStorage.mockResolvedValue({
      getObject: async () => ({
        body: jpegBody(),
        contentType: "image/jpeg",
        size: 3,
      }),
    });
    const response = await GET(new Request("http://localhost/hi/demo/photo.jpg"), {
      params: Promise.resolve({ slug: "demo" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  });
});
