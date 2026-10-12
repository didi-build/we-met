import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "@/exchange/client-ip";

describe("clientIpFromHeaders (unit)", () => {
  it("uses cf-connecting-ip only", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("returns unknown when cf-connecting-ip is missing", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1" });
    expect(clientIpFromHeaders(headers)).toBe("unknown");
  });
});
