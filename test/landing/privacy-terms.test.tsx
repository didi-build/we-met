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

const previewHost = "pr-42-we-met-preview.example.workers.dev";
const previewConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met-preview.example.workers.dev",
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
