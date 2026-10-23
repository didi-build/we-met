import { describe, expect, it } from "vitest";
import { parseVCardTokenBody, readVCardRequestBody } from "@/exchange/parse-vcard-body";

describe("parseVCardTokenBody", () => {
  it("accepts a JSON token field", () => {
    const result = parseVCardTokenBody({ token: "abc.def" });
    expect(result).toEqual({ ok: true, value: { token: "abc.def" } });
  });

  it("rejects missing token", () => {
    expect(parseVCardTokenBody({})).toEqual({ ok: false });
  });
});

describe("readVCardRequestBody", () => {
  it("reads form-encoded token", async () => {
    const request = new Request("https://we-met.link/api/exchange/vcard", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "token=signed.token",
    });
    const result = await readVCardRequestBody(request);
    expect(result).toEqual({
      ok: true,
      value: { token: "signed.token" },
      isFormEncoded: true,
    });
  });
});
