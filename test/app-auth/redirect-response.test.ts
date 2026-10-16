import { describe, expect, it } from "vitest";
import { redirectResponse } from "@/app-auth/redirect-response";

describe("redirectResponse (unit)", () => {
  it("allows setting cache-control and set-cookie after construction", () => {
    const response = redirectResponse("https://app.example/app", {
      setCookies: ["a=1; Path=/"],
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://app.example/app");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("a=1");
    expect(() => response.headers.set("x-test", "1")).not.toThrow();
  });
});
