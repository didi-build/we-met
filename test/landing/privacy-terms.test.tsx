// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PrivacyPolicyContent } from "@/components/landing/PrivacyPolicyContent";
import { TermsPolicyContent } from "@/components/landing/TermsPolicyContent";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHome } from "@/components/landing/LandingHome";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { resolvePrivacyMetadata, resolveTermsMetadata } from "@/lib/landing/metadata";
import { resolveLandingBrowseOrigin, resolveLandingUrls } from "@/lib/landing/urls";

const previewHost = "pr-42-we-met.example.workers.dev";
const previewConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met.example.workers.dev",
  weMetEnv: "preview",
};

const previewBrowseOrigin = resolveLandingBrowseOrigin(
  previewConfig,
  previewHost,
  "https",
);
const urls = resolveLandingUrls(previewConfig, previewBrowseOrigin);

const PRIVACY_H2 = [
  "Who we are",
  "What we collect",
  "Who can see the emails",
  "What the people you meet can see",
  "Google Contacts setup",
  "Who we share data with",
  "How long we keep it",
  "Deleting your data",
  "Changes",
] as const;

const TERMS_H2 = [
  "Using We Met",
  "Pre-alpha",
  "Your card and your content",
  "Your link",
  "Emails",
  "Privacy",
  "Liability",
  "Contact",
] as const;

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function IntersectionObserverStub() {
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
      };
    }),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("privacy and terms pages (unit)", () => {
  it("renders privacy h1, sections, contact link, and last updated", () => {
    render(<PrivacyPolicyContent />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeTruthy();
    for (const heading of PRIVACY_H2) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeTruthy();
    }
    expect(screen.getAllByText(/Cloudflare Email Service/).length).toBeGreaterThan(0);
    expect(screen.getByText(/duplicate exchange/)).toBeTruthy();
    expect(
      screen.getByText(/creating an exchange on your own card first/),
    ).toBeTruthy();
    expect(screen.queryByText(/Gmail/)).toBeNull();
    expect(screen.queryByText(/not shown on your public card page/)).toBeNull();
    const mailLinks = screen.getAllByRole("link", { name: "hello@we-met.link" });
    expect(mailLinks.length).toBeGreaterThan(0);
    for (const link of mailLinks) {
      expect(link.getAttribute("href")).toBe("mailto:hello@we-met.link");
    }
    expect(screen.getByText("Last updated: October 2026")).toBeTruthy();
  });

  it("uses approved contact card wording in visitor follow-up copy (DIDI-917)", () => {
    render(<PrivacyPolicyContent />);

    expect(
      screen.getByText(
        /That email also includes your display name on the card \(or your Google name if you left display name blank\), your role and photo, and your contact card, ready to save\./,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /When we send that optional follow-up email, if you added a phone number it is included in the contact card\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/contact card attached/)).toBeNull();
  });

  it("discloses relay default follow-up mode (DIDI-921)", () => {
    render(<PrivacyPolicyContent />);

    expect(
      screen.getByText(
        /In this default mode, we email the follow-up letter to you, not to them\. When you hit Reply, they get it from your own inbox, with your name, role and photo, and your contact card, ready to save\. The contact card uses your full Google name and includes your Google account email address, your phone number if you added one, and the links on your card\./,
      ),
    ).toBeTruthy();
  });

  it("discloses visitor receipt screen and default email wording (DIDI-924)", () => {
    render(<PrivacyPolicyContent />);

    expect(
      screen.getByText(
        /By default, we don't email them anything; you follow up from your own inbox, with Reply-To set to them\./,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Whether or not visitor follow-up email is on, right after someone exchanges details with you, their screen shows your Google account email address and your phone number if you added one, with buttons to email or call you, and your contact card, ready to save\. That screen stays available in their browser tab for up to two hours\./,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        /By default, we don't email them your contact card or your Google account email address;/,
      ),
    ).toBeNull();
  });

  it("renders terms h1, sections, contact link, and last updated", () => {
    render(<TermsPolicyContent urls={urls} />);

    expect(screen.getByRole("heading", { level: 1, name: "Terms" })).toBeTruthy();
    for (const heading of TERMS_H2) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeTruthy();
    }
    const mailLinks = screen.getAllByRole("link", { name: "hello@we-met.link" });
    expect(mailLinks.length).toBeGreaterThan(0);
    for (const link of mailLinks) {
      expect(link.getAttribute("href")).toBe("mailto:hello@we-met.link");
    }
    expect(screen.getByText("Last updated: October 2026")).toBeTruthy();
  });

  it("resolveLandingUrls returns preview browse-origin privacy and terms URLs", () => {
    expect(urls.privacy).toBe(`https://${previewHost}/privacy`);
    expect(urls.terms).toBe(`https://${previewHost}/terms`);
  });

  it("sets privacy and terms metadata from base URL config", () => {
    const privacy = resolvePrivacyMetadata(previewConfig);
    expect(privacy.title).toBe("Privacy | We Met");
    expect(privacy.description).toBeTruthy();
    expect(privacy.alternates?.canonical).toBe(`${previewConfig.baseUrl}/privacy`);

    const terms = resolveTermsMetadata(previewConfig);
    expect(terms.title).toBe("Terms | We Met");
    expect(terms.description).toBeTruthy();
    expect(terms.alternates?.canonical).toBe(`${previewConfig.baseUrl}/terms`);
  });
});

describe("landing privacy section and footer (unit)", () => {
  it("footer links to privacy and terms using urls from a non-production base URL", () => {
    render(
      <ThemeProvider>
        <LandingFooter urls={urls} />
      </ThemeProvider>,
    );

    const nav = screen.getByRole("navigation", { name: "Legal" });
    const privacy = within(nav).getByRole("link", { name: "Privacy" });
    const terms = within(nav).getByRole("link", { name: "Terms" });
    expect(privacy.getAttribute("href")).toBe(`https://${previewHost}/privacy`);
    expect(terms.getAttribute("href")).toBe(`https://${previewHost}/terms`);
    expect(privacy.getAttribute("href")).not.toBe("/privacy");
    expect(terms.getAttribute("href")).not.toBe("/terms");
  });

  it("landing home omits the email privacy teaser and footer still links to legal pages", () => {
    render(
      <ThemeProvider>
        <LandingHome urls={urls} getStartedLabel="Get started" />
      </ThemeProvider>,
    );

    expect(screen.queryByRole("heading", { name: /note on your emails/i })).toBeNull();

    const nav = screen.getByRole("navigation", { name: "Legal" });
    const privacy = within(nav).getByRole("link", { name: "Privacy" });
    const terms = within(nav).getByRole("link", { name: "Terms" });
    expect(privacy.getAttribute("href")).toBe(urls.privacy);
    expect(terms.getAttribute("href")).toBe(urls.terms);
  });
});
