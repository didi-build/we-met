import { createHttpApi } from "@/app-api/http-api";
import { describe, expect, it, vi } from "vitest";

describe("http API error mapping (unit)", () => {
  it("maps invalid-photo and rate-limited upload responses", async () => {
    const api = createHttpApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "invalid-photo" } }), {
            status: 422,
          }),
      ),
    );
    await expect(api.uploadPhoto(new Blob())).rejects.toMatchObject({
      code: "invalid-photo",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "rate-limited" } }), {
            status: 429,
          }),
      ),
    );
    await expect(api.uploadPhoto(new Blob())).rejects.toMatchObject({
      code: "rate-limited",
    });
  });

  it("maps publish slug-taken", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: { code: "slug-taken" } }), {
          status: 409,
        }),
    );
    const api = createHttpApi();
    await expect(
      api.publish({
        slug: "valid-slug",
        name: "n",
        role: "",
        photo: "",
        about: [],
        services: [],
        links: { website: "", linkedin: "", github: "", instagram: "" },
        alternate: { url: "", label: "" },
      }),
    ).rejects.toMatchObject({ code: "slug-taken" });
  });
});
