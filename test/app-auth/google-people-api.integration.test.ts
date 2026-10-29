import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveContactsSetupCompletion,
  syncWeMetGoogleContact,
} from "@/app-auth/google-people-api";
import { withIsolatedLocalD1 } from "../helpers/d1";

const fetchMock = vi.fn();
const PEOPLE_SEARCH_PATH = "/v1/people:searchContacts";
const READ_MASK = "names,emailAddresses";

function searchContactsCalls(): [string, RequestInit | undefined][] {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes("searchContacts"),
  ) as [string, RequestInit | undefined][];
}

function expectSearchContactsGet(
  call: [string, RequestInit | undefined],
  query: string,
  pageSize: number,
): void {
  const url = new URL(String(call[0]));
  expect(url.pathname).toBe(PEOPLE_SEARCH_PATH);
  expect(call[1]?.method ?? "GET").toBe("GET");
  expect(call[1]?.body).toBeUndefined();
  expect(url.searchParams.get("query")).toBe(query);
  expect(url.searchParams.get("readMask")).toBe(READ_MASK);
  expect(url.searchParams.get("pageSize")).toBe(String(pageSize));
}

describe("google people contact sync (unit)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("creates a contact when none matches", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ resourceName: "people/c1", etag: "e1" }),
      });

    const result = await syncWeMetGoogleContact("access-token-secret", [
      "hello@we-met.link",
      "hello@mail.we-met.link",
    ]);
    expect(result).toEqual({
      ok: true,
      addressesAdded: ["hello@we-met.link", "hello@mail.we-met.link"],
    });

    const searches = searchContactsCalls();
    expect(searches).toHaveLength(3);
    expectSearchContactsGet(searches[0], "", 1);
    expectSearchContactsGet(searches[1], "hello@we-met.link", 30);
    expectSearchContactsGet(searches[2], "hello@mail.we-met.link", 30);

    const createCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("createContact"),
    );
    expect(createCall).toBeTruthy();
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body.names[0].givenName).toBe("We Met");
    expect(body.emailAddresses).toHaveLength(2);
  });

  it("updates an existing contact that is missing an address", async () => {
    const person = {
      resourceName: "people/c9",
      etag: "etag-9",
      emailAddresses: [{ value: "hello@we-met.link" }],
    };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ person }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const result = await syncWeMetGoogleContact("token", [
      "hello@we-met.link",
      "hello@mail.we-met.link",
    ]);
    expect(result).toEqual({ ok: true, addressesAdded: ["hello@mail.we-met.link"] });

    const searches = searchContactsCalls();
    expect(searches).toHaveLength(2);
    expectSearchContactsGet(searches[0], "", 1);
    expectSearchContactsGet(searches[1], "hello@we-met.link", 30);

    const patchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("updateContact"),
    );
    expect(patchCall).toBeTruthy();
    const patchUrl = new URL(String(patchCall?.[0]));
    expect(patchCall?.[1]?.method).toBe("PATCH");
    expect(patchUrl.pathname).toBe("/v1/people/c9:updateContact");
    expect(patchUrl.searchParams.get("updatePersonFields")).toBe("emailAddresses");
    const body = JSON.parse(String(patchCall?.[1]?.body));
    expect(body.emailAddresses[0]).toEqual({ value: "hello@we-met.link" });
    expect(body.emailAddresses[1]).toEqual({ value: "hello@mail.we-met.link" });
  });

  it("preserves existing email address objects when appending", async () => {
    const person = {
      resourceName: "people/c9",
      etag: "etag-9",
      emailAddresses: [{ value: "Hello@We-Met.Link", type: "home" }],
    };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ person }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await syncWeMetGoogleContact("token", [
      "hello@we-met.link",
      "hello@mail.we-met.link",
    ]);

    const patchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("updateContact"),
    );
    const body = JSON.parse(String(patchCall?.[1]?.body));
    expect(body.emailAddresses[0]).toEqual({
      value: "Hello@We-Met.Link",
      type: "home",
    });
    expect(body.emailAddresses[1]).toEqual({ value: "hello@mail.we-met.link" });
  });

  it("does not create a contact when searchContacts fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    const result = await syncWeMetGoogleContact("token", ["hello@we-met.link"]);
    expect(result).toEqual({ ok: false, reason: "people_api_failed" });
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("createContact")),
    ).toBe(false);
  });

  it("does nothing when the contact already has every address", async () => {
    const person = {
      resourceName: "people/c9",
      etag: "etag-9",
      emailAddresses: [
        { value: "hello@we-met.link" },
        { value: "hello@mail.we-met.link" },
      ],
    };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ person }] }),
      });

    const result = await syncWeMetGoogleContact("token", [
      "hello@we-met.link",
      "hello@mail.we-met.link",
    ]);
    expect(result).toEqual({ ok: true, addressesAdded: [] });
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("createContact")),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("updateContact")),
    ).toBe(false);
  });
});

describe("contacts setup D1 writes (integration)", () => {
  it("never stores Google access tokens in accounts", async () => {
    await withIsolatedLocalD1(async (db) => {
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub', 'owner@example.com', 'Owner', 'active', 't', 't')`,
        )
        .run();

      await saveContactsSetupCompletion(db, "a1", ["hello@we-met.link"], null);

      const row = await db
        .prepare(
          "SELECT contact_added_at, contact_sender_addresses FROM accounts WHERE id = 'a1'",
        )
        .first<{ contact_added_at: string; contact_sender_addresses: string }>();
      expect(row?.contact_added_at).toBeTruthy();
      expect(row?.contact_sender_addresses).toContain("hello@we-met.link");
      expect(row?.contact_sender_addresses).not.toContain("ya29.");
      expect(JSON.stringify(row)).not.toContain("access");
    });
  });
});
