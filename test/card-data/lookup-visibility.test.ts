import { describe, expect, it } from "vitest";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import { lookupCard } from "@/card-data/lookup";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { upsertCardWithEmailSink } from "../helpers/card-email-sink";
import { exampleCardInput } from "../helpers/example-card";

const hostConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met.diademshoukralla.workers.dev",
  weMetEnv: "production",
};

async function seedVisibleCard(
  repo: MemoryCardRepository,
  slug: string,
  overrides: Parameters<typeof upsertCardWithEmailSink>[1] = exampleCardInput(),
) {
  const card = await upsertCardWithEmailSink(repo, { ...overrides, slug });
  return card;
}

describe("lookup visibility (unit)", () => {
  it("hides suspended and retired cards by slug", async () => {
    const repo = new MemoryCardRepository();
    await seedVisibleCard(repo, "live-card");
    const suspended = await repo.upsertCard({
      ...exampleCardInput(),
      slug: "suspended-card",
      status: "suspended",
    });
    await repo.addLeadSink(suspended.id, {
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
      enabled: true,
    });
    const retired = await repo.upsertCard({
      ...exampleCardInput(),
      slug: "retired-card",
      status: "retired",
    });
    await repo.addLeadSink(retired.id, {
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
      enabled: true,
    });

    expect(
      await lookupCard(
        { hostname: "we-met.link", pathname: "/hi/live-card" },
        repo,
        hostConfig,
      ),
    ).not.toBeNull();
    expect(
      await lookupCard(
        { hostname: "we-met.link", pathname: "/hi/suspended-card" },
        repo,
        hostConfig,
      ),
    ).toBeNull();
    expect(
      await lookupCard(
        { hostname: "we-met.link", pathname: "/hi/retired-card" },
        repo,
        hostConfig,
      ),
    ).toBeNull();
  });

  it("hides cards when the account is not active", async () => {
    const repo = new MemoryCardRepository();
    const card = await seedVisibleCard(repo, "acct-status");
    for (const status of ["waitlisted", "suspended", "deleted"] as const) {
      repo.setAccountStatus(card.accountId, status);
      expect(
        await lookupCard(
          { hostname: "we-met.link", pathname: "/hi/acct-status" },
          repo,
          hostConfig,
        ),
      ).toBeNull();
    }
    repo.setAccountStatus(card.accountId, "active");
    expect(
      await lookupCard(
        { hostname: "we-met.link", pathname: "/hi/acct-status" },
        repo,
        hostConfig,
      ),
    ).not.toBeNull();
  });

  it("hides cards by hostname for the same visibility rules", async () => {
    const repo = new MemoryCardRepository();
    const card = await seedVisibleCard(repo, "host-hide");
    await repo.upsertHostname({ hostname: "card.example.com", slug: "host-hide" });
    repo.setAccountStatus(card.accountId, "suspended");
    expect(
      await lookupCard({ hostname: "card.example.com", pathname: "/" }, repo, hostConfig),
    ).toBeNull();
  });

  it("returns not found without exactly one enabled email sink", async () => {
    const repo = new MemoryCardRepository();
    const none = await repo.upsertCard({ ...exampleCardInput(), slug: "no-sink" });
    expect(none.id).toBeTruthy();
    expect(
      await lookupCard(
        { hostname: "we-met.link", pathname: "/hi/no-sink" },
        repo,
        hostConfig,
      ),
    ).toBeNull();

    const two = await repo.upsertCard({ ...exampleCardInput(), slug: "two-sinks" });
    await repo.addLeadSink(two.id, {
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
      enabled: true,
    });
    await repo.addLeadSink(two.id, {
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
      enabled: true,
    });
    expect(
      await lookupCard(
        { hostname: "we-met.link", pathname: "/hi/two-sinks" },
        repo,
        hostConfig,
      ),
    ).toBeNull();
  });
});
