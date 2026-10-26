// @vitest-environment jsdom

import { WeMetApp } from "@/components/app/WeMetApp";
import { WeMetEnvironmentChrome } from "@/components/we-met/WeMetEnvironmentChrome";
import { AppTestShell, setupAppEditorDom } from "./harness";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

describe("WeMetApp sign-in by environment (integration)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("shows Google sign-in on staging like production", async () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "staging");
    render(
      <AppTestShell>
        <WeMetApp />
      </AppTestShell>,
    );
    await waitFor(() => expect(screen.getByText("Make your We Met card")).toBeTruthy());
    expect(screen.getByText(/Sign in with Google/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Preview sign-in/i)).toBeNull();
  });

  it("shows Google sign-in when not on preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "local");
    render(
      <AppTestShell>
        <WeMetApp />
      </AppTestShell>,
    );
    await waitFor(() => expect(screen.getByText("Make your We Met card")).toBeTruthy());
    expect(screen.getByText(/Sign in with Google/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Preview sign-in/i)).toBeNull();
  });

  it("shows Google sign-in in production without an environment banner", async () => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "production");
    render(
      <>
        <WeMetEnvironmentChrome />
        <AppTestShell>
          <WeMetApp />
        </AppTestShell>
      </>,
    );
    await waitFor(() => expect(screen.getByText("Make your We Met card")).toBeTruthy());
    expect(screen.getByText(/Sign in with Google/i)).toBeTruthy();
    expect(screen.queryByTestId("we-met-environment-banner")).toBeNull();
  });
});
