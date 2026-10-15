import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EMAIL_SENTINEL,
  resolveLeadSinksForDispatch,
} from "@/card-data/account-email";
import type { LeadSinkRecord } from "@/card-data/types";

describe("account email sink resolution (unit)", () => {
  it("resolves account_email to the owner address in queue snapshots", () => {
    const sinks: LeadSinkRecord[] = [
      {
        id: "sink-1",
        cardId: "card-1",
        kind: "email",
        config: { to: ACCOUNT_EMAIL_SENTINEL },
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const resolved = resolveLeadSinksForDispatch(sinks, "owner@example.com");
    expect(resolved[0]?.config).toEqual({ to: "owner@example.com" });
  });
});
