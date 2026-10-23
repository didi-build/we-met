import { describe, expect, it } from "vitest";
import {
  ownerContactFromSessionFields,
  toHiPageCard,
} from "@/lib/hi-card/hi-page-card";
import { exampleCardRecord } from "../helpers/example-card";

describe("ownerContactFromSessionFields (unit)", () => {
  it("returns null when both owner email and phone are empty", () => {
    expect(ownerContactFromSessionFields("", "")).toBeNull();
    expect(ownerContactFromSessionFields("  ", "\t")).toBeNull();
  });

  it("returns trimmed contact when either field is present", () => {
    expect(ownerContactFromSessionFields("  owner@example.com  ", "")).toEqual({
      email: "owner@example.com",
      phone: "",
    });
    expect(ownerContactFromSessionFields("", " +1 555 0100 ")).toEqual({
      email: "",
      phone: "+1 555 0100",
    });
  });
});

describe("toHiPageCard (unit)", () => {
  it("removes owner email and phone from the public page card", () => {
    const record = exampleCardRecord({
      email: "owner@example.com",
      contact: {
        ...exampleCardRecord().contact,
        phone: "+1 555 0100",
      },
    });
    const pageCard = toHiPageCard(record);
    expect("email" in pageCard).toBe(false);
    expect(pageCard.contact).not.toHaveProperty("phone");
    expect(JSON.stringify(pageCard)).not.toContain("owner@example.com");
    expect(JSON.stringify(pageCard)).not.toContain("+1 555 0100");
    expect(pageCard.accountId).toBe(record.accountId);
    expect(pageCard.contact.urls).toEqual(record.contact.urls);
    expect(pageCard.contact.vcardNote).toBe(record.contact.vcardNote);
  });
});
