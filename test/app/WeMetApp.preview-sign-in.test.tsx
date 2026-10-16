// @vitest-environment jsdom

import { WeMetApp } from "@/components/app/WeMetApp";
import { AppTestShell, setupAppEditorDom } from "./harness";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

setupAppEditorDom();

describe("WeMetApp preview sign-in (integration)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WE_MET_ENV", "preview");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("shows preview sign-in and does not offer Google sign-in", async () => {
    render(
      <AppTestShell>
        <WeMetApp />
      </AppTestShell>,
    );
    await waitFor(() => expect(screen.getByText("Make your We Met card")).toBeTruthy());
    expect(screen.getByText(/Google sign-in is turned off on previews/i)).toBeTruthy();
    expect(screen.getByLabelText(/Preview sign-in/i)).toBeTruthy();
    expect(screen.queryByText(/Sign in with Google/i)).toBeNull();
  });
});
