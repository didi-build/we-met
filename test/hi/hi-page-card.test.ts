import { describe, expect, it } from "vitest";
import { toHiPageCard } from "@/lib/hi-card/hi-page-card";
import { exampleCardRecord } from "../helpers/example-card";

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
  });
});
