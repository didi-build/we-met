// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WeMetEnvironmentBanner } from "@/components/we-met/WeMetEnvironmentBanner";
import { WeMetEnvironmentChrome } from "@/components/we-met/WeMetEnvironmentChrome";

describe("WeMetEnvironmentBanner (unit)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders staging and preview labels with optional commit SHA", () => {
    const { rerender } = render(
      <WeMetEnvironmentBanner label="Staging" shortSha="deadbeef" />,
    );
    expect(screen.getByTestId("we-met-environment-banner").textContent).toBe(
      "Staging · deadbeef",
    );

    rerender(<WeMetEnvironmentBanner label="Preview" shortSha="" />);
    expect(screen.getByTestId("we-met-environment-banner").textContent).toBe("Preview");
  });
});

describe("WeMetEnvironmentChrome (unit)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders nothing in production", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_WE_MET_COMMIT_SHA", "abc1234");
    const { container } = render(<WeMetEnvironmentChrome />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the staging banner", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_WE_MET_COMMIT_SHA", "");
    render(<WeMetEnvironmentChrome />);
    expect(screen.getByTestId("we-met-environment-banner").textContent).toBe("Staging");
  });

  it("renders the preview banner", () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_WE_MET_COMMIT_SHA", "");
    render(<WeMetEnvironmentChrome />);
    expect(screen.getByTestId("we-met-environment-banner").textContent).toBe("Preview");
  });
});
