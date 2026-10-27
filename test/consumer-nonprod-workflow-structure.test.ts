import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CONSUMER_SECRET_CHECK_STEP_NAME = "Require consumer Worker secrets (names only)";
const WORKER_NAME = "we-met-followup-email-consumer-nonprod";
const CONSUMER_TOKEN = "CLOUDFLARE_API_TOKEN_CONSUMER_NONPROD";

describe("Deploy consumer non-prod workflow structure (unit)", () => {
  const workflow = readFileSync(
    ".github/workflows/deploy-consumer-nonprod.yml",
    "utf8",
  );

  it("secret check step does not echo raw wrangler stdout or stderr on failure", () => {
    const stepStart = workflow.indexOf(CONSUMER_SECRET_CHECK_STEP_NAME);
    expect(stepStart).toBeGreaterThan(-1);
    const deployStepStart = workflow.indexOf(
      "Deploy follow-up email consumer to non-prod",
    );
    const stepBlock = workflow.slice(stepStart, deployStepStart);
    expect(stepBlock).not.toContain("stdoutPreview");
    expect(stepBlock).not.toMatch(/cat "\$SECRET_LIST_STDERR"/);
    expect(stepBlock).not.toMatch(/cat "\$SECRET_LIST_STDOUT"/);
    expect(stepBlock).not.toContain("wrangler stderr:");
    expect(stepBlock).not.toContain("first 200 chars");
    expect(stepBlock).not.toMatch(/add the minimum Cloudflare permission/i);
    expect(stepBlock).not.toMatch(/Workers Editor alone is UNVERIFIED/i);
    expect(stepBlock).toContain(`grep -oE '\\[code: [0-9]+\\]' "$SECRET_LIST_STDERR"`);
    expect(stepBlock).toContain(
      `::error::wrangler secret list failed for Worker ${WORKER_NAME} using ${CONSUMER_TOKEN}`,
    );
    expect(stepBlock).toContain("docs/decisions/0017-cloudflare-api-credentials.md");
    expect(stepBlock).toContain("Non-prod follow-up consumer deploy was stopped");
  });

  it("secret check step uses consumer-nonprod token only", () => {
    const stepStart = workflow.indexOf(CONSUMER_SECRET_CHECK_STEP_NAME);
    const deployStepStart = workflow.indexOf(
      "Deploy follow-up email consumer to non-prod",
    );
    const stepBlock = workflow.slice(stepStart, deployStepStart);
    expect(stepBlock).toContain(
      `CLOUDFLARE_API_TOKEN: \${{ secrets.${CONSUMER_TOKEN} }}`,
    );
    expect(stepBlock).not.toContain("CLOUDFLARE_API_TOKEN_PRODUCTION");
    expect(stepBlock).not.toContain("CLOUDFLARE_API_TOKEN_PREVIEW");
  });

  it("secret check requires three non-prod consumer secret names", () => {
    const stepStart = workflow.indexOf(CONSUMER_SECRET_CHECK_STEP_NAME);
    const deployStepStart = workflow.indexOf(
      "Deploy follow-up email consumer to non-prod",
    );
    const stepBlock = workflow.slice(stepStart, deployStepStart);
    expect(stepBlock).toContain("WE_MET_EMAIL_FROM_CLOUDFLARE");
    expect(stepBlock).toContain("WE_MET_FROM_DISPLAY_NAME");
    expect(stepBlock).toContain("WE_MET_TEST_MAIL_TO");
    expect(stepBlock).toContain(`--name ${WORKER_NAME}`);
  });
});
