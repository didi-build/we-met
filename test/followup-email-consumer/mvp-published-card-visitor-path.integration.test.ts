import { publishCard, saveDraft } from "@/app-card/card-store";
import type { EditorCard } from "@/app-api/types";
import { D1CardRepository } from "@/card-data/d1-repository";
import { lookupCard } from "@/card-data/lookup";
import { buildCardEmailSnapshot } from "@/exchange/card-snapshot";
import { buildOwnerVCardAttachment } from "@/followup-email-consumer/load-vcard-photo";
import { parseVisitorFollowupMessage } from "@/followup-email-consumer/validate";
import { describe, expect, it, vi } from "vitest";
import { withIsolatedLocalD1 } from "../helpers/d1";

const ACCOUNT_ID = "a-mvp-visitor-path";
const OWNER_EMAIL = "mvp-owner@example.com";
const CARD_SLUG = "mvp-visitor-path";

const hostConfig = {
  baseUrl: "https://we-met.link",
  previewHostSuffix: "-we-met.example.workers.dev",
  weMetEnv: "production",
};

function validEditorCard(overrides: Partial<EditorCard> = {}): EditorCard {
  return {
    slug: CARD_SLUG,
    name: "Mvp Owner",
    role: "Founder",
    photo: "",
    about: ["About paragraph."],
    services: Array.from({ length: 10 }, (_, i) => ({
      title: `Service ${i}`,
      description: "Desc",
    })),
    links: {
      website: "https://example.com",
      linkedin: "",
      github: "",
      instagram: "",
    },
    alternate: { url: "", label: "" },
    ...overrides,
  };
}

describe("published MVP card visitor follow-up path (integration)", () => {
  it("lookup → buildCardEmailSnapshot → parseVisitorFollowupMessage → vCard uses accounts.email", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES (?, 'sub-mvp-visitor', ?, 'Mvp Owner', 'active', ?, ?)`,
        )
        .bind(ACCOUNT_ID, OWNER_EMAIL, now, now)
        .run();

      const editorCard = validEditorCard();
      await saveDraft(db, ACCOUNT_ID, editorCard);
      await publishCard(db, ACCOUNT_ID, editorCard, null);

      const contactRow = await db
        .prepare("SELECT contact_json FROM cards WHERE account_id = ?")
        .bind(ACCOUNT_ID)
        .first<{ contact_json: string }>();
      expect(contactRow).toBeTruthy();
      const storedContact = JSON.parse(contactRow!.contact_json) as Record<
        string,
        unknown
      >;
      expect(storedContact).not.toHaveProperty("email");

      const repo = new D1CardRepository(db);
      const card = await lookupCard(
        { hostname: "we-met.link", pathname: `/hi/${CARD_SLUG}` },
        repo,
        hostConfig,
      );
      expect(card).not.toBeNull();
      expect(card!.email).toBe(OWNER_EMAIL);
      expect(card!.contact).not.toHaveProperty("email");
      expect(card!.contact.name.full).toBe("Mvp Owner");

      const snapshot = buildCardEmailSnapshot(card!);
      expect(snapshot.email).toBe(OWNER_EMAIL);
      expect(snapshot.pageCopy.emailFromName).toBe("Mvp Owner");

      const lead = {
        leadId: "lead-mvp-visitor",
        submittedAt: "2026-10-17T00:00:00.000Z",
        environment: "preview",
        isTestLead: true,
        name: "Alex Visitor",
        email: "visitor@example.com",
        phone: null as string | null,
      };

      const parsed = parseVisitorFollowupMessage({
        type: "visitor_followup",
        lead,
        card: snapshot,
      });
      expect(parsed).not.toBeNull();

      const { vcardBody } = await buildOwnerVCardAttachment(
        parsed!.card.contact,
        parsed!.card.email,
        parsed!.card.photoKey,
        { get: vi.fn(async () => null) },
        { logMissingPhoto: vi.fn(), logNonJpegPhoto: vi.fn() },
      );

      expect(vcardBody).toContain(`EMAIL;TYPE=INTERNET,WORK:${OWNER_EMAIL}`);
      expect(vcardBody).toContain("FN:Mvp Owner");
      expect(vcardBody).not.toMatch(/EMAIL;TYPE=INTERNET,WORK:\s*$/m);
    });
  });
});
