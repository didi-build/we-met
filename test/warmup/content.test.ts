import { describe, expect, it } from "vitest";
import { buildWarmupContent } from "../../workers/warmup/lib/content";

describe("warmup content (unit)", () => {
  it("varies subject and body independently", () => {
    const subjectLow = buildWarmupContent(0.01, 0.5);
    const subjectHigh = buildWarmupContent(0.99, 0.5);
    expect(subjectLow.subject).not.toBe(subjectHigh.subject);
    expect(subjectLow.text).toBe(subjectHigh.text);

    const bodyLow = buildWarmupContent(0.5, 0.01);
    const bodyHigh = buildWarmupContent(0.5, 0.99);
    expect(bodyLow.subject).toBe(bodyHigh.subject);
    expect(bodyLow.text).not.toBe(bodyHigh.text);
  });
});
