import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveContactsSetupCompletion,
  syncWeMetGoogleContact,
} from "@/app-auth/google-people-api";
import { withIsolatedLocalD1 } from "../helpers/d1";

const fetchMock = vi.fn();

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

    const patchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("updateContact"),
    );
    expect(patchCall).toBeTruthy();
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
