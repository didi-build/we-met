// @vitest-environment jsdom

import { PublishedContactsSetup } from "@/components/app/editor/PublishedContactsSetup";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("PublishedContactsSetup (unit)", () => {
  it("renders default copy without aria-live", () => {
    const { container } = render(
      <PublishedContactsSetup
        setup={{ visible: true, variant: "default" }}
        phase="default"
        onContinueGoogle={vi.fn()}
        onAddAddress={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(
      screen.getByText(/Follow-ups from people you meet come from We Met/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Google asks once. We only create or update the We Met contact./,
      ),
    ).toBeTruthy();
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-live")).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders reappear copy", () => {
    render(
      <PublishedContactsSetup
        setup={{
          visible: true,
          variant: "reappear",
          newSenderAddress: "hello@send.we-met.link",
        }}
        phase="default"
        onContinueGoogle={vi.fn()}
        onAddAddress={vi.fn()}
      />,
    );
    expect(screen.getByText("We added a new sending address")).toBeTruthy();
    expect(screen.getByText("hello@send.we-met.link")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add to my We Met contact" }),
    ).toBeTruthy();
  });

  it("renders working state with aria-live and role status", () => {
    const { container } = render(
      <PublishedContactsSetup
        setup={{ visible: false }}
        phase="working"
        onContinueGoogle={vi.fn()}
        onAddAddress={vi.fn()}
      />,
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-live")).toBe("polite");
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(screen.getByText("Adding We Met to your contacts")).toBeTruthy();
    expect(
      screen.getByText(/Saving both sending addresses to one contact/),
    ).toBeTruthy();
  });

  it("renders success state with aria-live and role status", () => {
    const { container } = render(
      <PublishedContactsSetup
        setup={{ visible: false }}
        phase="success"
        onContinueGoogle={vi.fn()}
        onAddAddress={vi.fn()}
      />,
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-live")).toBe("polite");
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(screen.getByText("You're all set")).toBeTruthy();
    expect(
      screen.getByText(/We Met is in your Google Contacts with both addresses/),
    ).toBeTruthy();
  });
});
