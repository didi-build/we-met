import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cloudflare credentials in deploy workflows (unit)", () => {
  const preview = readFileSync(".github/workflows/preview.yml", "utf8");
  const production = readFileSync(".github/workflows/deploy-production.yml", "utf8");

  it("preview workflow uses non-prod Turnstile repository variable", () => {
    expect(preview).toContain("vars.WE_MET_TURNSTILE_SITE_KEY_NONPROD");
    expect(preview).not.toContain("WE_MET_TURNSTILE_SITE_KEY_PRODUCTION");
  });

  it("preview OpenNext build sets WE_MET_ENV=preview for client bundle", () => {
    expect(preview).toMatch(
      /Build OpenNext[\s\S]*?WE_MET_ENV:\s*preview[\s\S]*?npm run build/,
    );
  });

  it("production deploy workflow does not set WE_MET_BASE_URL anywhere (next.config fallback)", () => {
    expect(production).not.toContain("WE_MET_BASE_URL");
  });

  it("production workflow uses production Turnstile variable", () => {
    expect(production).toContain("vars.WE_MET_TURNSTILE_SITE_KEY_PRODUCTION");
    expect(production).not.toContain("WE_MET_TURNSTILE_SITE_KEY_NONPROD");
  });

  it("preview workflow uses preview-scoped Cloudflare API token only", () => {
    expect(preview).toContain("secrets.CLOUDFLARE_API_TOKEN_PREVIEW");
    expect(preview).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(preview).not.toMatch(/secrets\.CLOUDFLARE_API_TOKEN[^_]/);
  });

  it("production workflow uses production Cloudflare API token only", () => {
    expect(production).toContain("secrets.CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(production).not.toContain("CLOUDFLARE_API_TOKEN_PREVIEW");
    expect(production).not.toMatch(/secrets\.CLOUDFLARE_API_TOKEN[^_]/);
  });

  it("both workflows use repo-level CLOUDFLARE_ACCOUNT_ID", () => {
    expect(preview).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(production).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(production).not.toContain("secrets.CLOUDFLARE_ACCOUNT_ID_PRODUCTION");
  });
});
