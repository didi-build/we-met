import { describe, expect, it } from "vitest";
import { computeContactsSetupUi } from "@/app-auth/contacts-setup-visibility";

const env = {
  WE_MET_CONTACT_SENDER_ADDRESSES: "hello@we-met.link,hello@mail.we-met.link",
  CONTACTS_SETUP_ALLOWLIST: "owner@example.com",
  CONTACTS_SETUP_ENABLED_FOR_ALL: "false",
} as CloudflareEnv;

describe("contacts setup visibility (unit)", () => {
  it("hides the row for ineligible owners", () => {
    const ui = computeContactsSetupUi(
      env,
      {
        email: "stranger@example.com",
        contact_added_at: null,
        contact_sender_addresses: null,
      },
      false,
    );
    expect(ui).toEqual({ visible: false });
  });

  it("shows default when eligible and not yet added", () => {
    const ui = computeContactsSetupUi(
      env,
      {
        email: "owner@example.com",
        contact_added_at: null,
        contact_sender_addresses: null,
      },
      false,
    );
    expect(ui).toEqual({ visible: true, variant: "default" });
  });

  it("hides when every configured address is already saved", () => {
    const ui = computeContactsSetupUi(
      env,
      {
        email: "owner@example.com",
        contact_added_at: "2026-10-01T00:00:00.000Z",
        contact_sender_addresses: JSON.stringify([
          "hello@we-met.link",
          "hello@mail.we-met.link",
        ]),
      },
      false,
    );
    expect(ui).toEqual({ visible: false });
  });

  it("shows reappear with the new sender address", () => {
    const ui = computeContactsSetupUi(
      {
        ...env,
        WE_MET_CONTACT_SENDER_ADDRESSES:
          "hello@we-met.link,hello@mail.we-met.link,hello@send.we-met.link",
      },
      {
        email: "owner@example.com",
        contact_added_at: "2026-10-01T00:00:00.000Z",
        contact_sender_addresses: JSON.stringify([
          "hello@we-met.link",
          "hello@mail.we-met.link",
        ]),
      },
      false,
    );
    expect(ui).toEqual({
      visible: true,
      variant: "reappear",
      newSenderAddress: "hello@send.we-met.link",
    });
  });

  it("hides when declined this session", () => {
    const ui = computeContactsSetupUi(
      env,
      {
        email: "owner@example.com",
        contact_added_at: null,
        contact_sender_addresses: null,
      },
      true,
    );
    expect(ui).toEqual({ visible: false });
  });
});
