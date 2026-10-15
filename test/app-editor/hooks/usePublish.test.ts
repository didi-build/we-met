import {
  publishBlockerSentence,
  publishBlockers,
} from "@/lib/app-editor/hooks/usePublish";
import { describe, expect, it } from "vitest";

describe("publishBlockers (unit)", () => {
  it("lists missing name and slug", () => {
    const blockers = publishBlockers({
      slugEditing: false,
      name: "",
      slug: "",
      slugStatus: "empty",
      fieldKeys: ["name", "slug"],
      fieldError: () => "",
    });
    expect(blockers).toContain("add your name");
    expect(blockers).toContain("choose your link");
  });

  it("requires slug confirmation while editing locked slug", () => {
    const blockers = publishBlockers({
      slugEditing: true,
      name: "Ada",
      slug: "ada",
      slugStatus: "available",
      fieldKeys: [],
      fieldError: () => "",
    });
    expect(blockers[0]).toMatch(/confirm your new link/);
  });
});

describe("usePublish publishState (unit)", () => {
  it("is wired through publishBlockers for waiting slug check", () => {
    const blockers = publishBlockers({
      slugEditing: false,
      name: "Ada",
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
