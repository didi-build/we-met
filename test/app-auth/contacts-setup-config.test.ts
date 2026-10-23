import { describe, expect, it } from "vitest";
import {
  isContactsSetupEligible,
  readContactsSetupAllowlist,
} from "@/app-auth/contacts-setup-config";

describe("contacts setup allowlist (unit)", () => {
  it("treats unset allowlist as empty", () => {
    expect(readContactsSetupAllowlist({} as CloudflareEnv)).toEqual([]);
    expect(isContactsSetupEligible({} as CloudflareEnv, "owner@example.com")).toBe(
      false,
    );
  });

  it("treats blank allowlist as empty", () => {
    const env = {
      CONTACTS_SETUP_ALLOWLIST: "   ",
      CONTACTS_SETUP_ENABLED_FOR_ALL: "false",
    } as CloudflareEnv;
    expect(readContactsSetupAllowlist(env)).toEqual([]);
    expect(isContactsSetupEligible(env, "owner@example.com")).toBe(false);
  });

  it("allows only listed emails when enabled for all is false", () => {
    const env = {
      CONTACTS_SETUP_ALLOWLIST: "owner@example.com",
      CONTACTS_SETUP_ENABLED_FOR_ALL: "false",
    } as CloudflareEnv;
    expect(isContactsSetupEligible(env, "owner@example.com")).toBe(true);
    expect(isContactsSetupEligible(env, "other@example.com")).toBe(false);
  });

  it("allows everyone when CONTACTS_SETUP_ENABLED_FOR_ALL is true", () => {
    const env = {
      CONTACTS_SETUP_ENABLED_FOR_ALL: "true",
    } as CloudflareEnv;
    expect(isContactsSetupEligible(env, "anyone@example.com")).toBe(true);
  });
});
