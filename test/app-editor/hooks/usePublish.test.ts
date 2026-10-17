import {
  publishBlockerSentence,
  publishBlockers,
} from "@/lib/app-editor/hooks/usePublish";
import { describe, expect, it } from "vitest";

describe("publishBlockers (unit)", () => {
  it("lists missing slug without requiring display name on the client", () => {
    const blockers = publishBlockers({
      slug: "",
      slugStatus: "empty",
      fieldKeys: ["name", "slug"],
      fieldError: () => "",
    });
    expect(blockers).not.toContain("add your name");
    expect(blockers).toContain("choose your link");
  });
});

describe("usePublish publishState (unit)", () => {
  it("is wired through publishBlockers for waiting slug check", () => {
    const blockers = publishBlockers({
      slug: "ada",
      slugStatus: "checking",
      fieldKeys: [],
      fieldError: () => "",
    });
    expect(blockers).toContain("wait for your link to be checked");
  });
});

describe("publishBlockerSentence (unit)", () => {
  it("formats the publish gate message", () => {
    expect(publishBlockerSentence(["add your name", "choose your link"])).toBe(
      "To publish, add your name and choose your link.",
    );
  });
});
