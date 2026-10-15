import { createStubApi } from "@/app-api/stub-api";
import { describe, expect, it } from "vitest";

describe("createStubApi (integration)", () => {
  it("signIn returns a session", async () => {
    const api = createStubApi("");
    expect(await api.getSession()).toBeNull();
    const session = await api.signIn();
    expect(session.email).toContain("@");
    expect(session.allowed).toBe(true);
  });

  it("checkSlug marks reserved slugs", async () => {
    const api = createStubApi("");
    await api.signIn();
    const result = await api.checkSlug("app");
    expect(result.status).toBe("reserved");
  });
});
