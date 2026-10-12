import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HI_EXCHANGE_REQUEST_TIMEOUT_MS,
  postHiExchange,
} from "@/components/hi/hi-exchange-api";

describe("postHiExchange", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns timeout when the request does not complete in time", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      ),
    );

    const promise = postHiExchange({
      slug: "demo",
      name: "Sam",
      email: "sam@example.com",
      turnstileToken: "token",
    });
    await vi.advanceTimersByTimeAsync(HI_EXCHANGE_REQUEST_TIMEOUT_MS + 5);
    const result = await promise;
    expect(result).toEqual({ ok: false, kind: "timeout" });
  });

  it("returns server failure for non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: "nope" }), { status: 500 }),
      ),
    );
    const result = await postHiExchange({
      slug: "demo",
      name: "Sam",
      email: "sam@example.com",
      turnstileToken: "token",
    });
    expect(result).toEqual({ ok: false, kind: "server", message: "nope" });
  });

  it("posts to /api/exchange", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "t" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await postHiExchange({
      slug: "demo",
      name: "Sam",
      email: "sam@example.com",
      turnstileToken: "token",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/exchange",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns network failure when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const result = await postHiExchange({
      slug: "demo",
      name: "Sam",
      email: "sam@example.com",
      turnstileToken: "token",
    });
    expect(result).toEqual({ ok: false, kind: "network" });
  });
});
