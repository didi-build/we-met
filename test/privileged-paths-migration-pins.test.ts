import { describe, expect, it } from "vitest";
import {
  isPrivilegedFlagInfrastructurePath,
  isPrivilegedPath,
  privilegedPathMatchers,
} from "../scripts/lib/privileged-paths.mjs";

/** Per-file pins for migrations/ (DIDI-995 item 13). */
const MIGRATION_PIN_PATHS = [
  "migrations/.gitkeep",
  "migrations/0002_lead_delivery_ledger.sql",
  "migrations/0003_lead_delivery_ledger_external_ref.sql",
  "migrations/0004_mvp_accounts_additive.sql",
  "migrations/0005_cards_rebuild_mvp.sql",
  "migrations/0006_photo_upload_log.sql",
  "migrations/0007_contacts_setup.sql",
  "migrations/0008_exchange_owner_email.sql",
  "migrations/0009_exchange_owner_email_visitor_letter.sql",
] as const;

describe("privileged-paths migration pins (DIDI-995)", () => {
  for (const path of MIGRATION_PIN_PATHS) {
    it(`${path} is privileged and infrastructure`, () => {
      expect(isPrivilegedPath(path)).toBe(true);
      expect(isPrivilegedFlagInfrastructurePath(path)).toBe(true);
    });

    it(`mutant: migrations matcher removal unpins ${path}`, () => {
      const matchers = privilegedPathMatchers.filter((m) => m.id !== "migrations");
      const isPrivilegedPathWithoutMigrations = (filename: string) =>
        matchers.some((m) => m.test(filename));
      expect(isPrivilegedPathWithoutMigrations(path)).toBe(false);
    });
  }
});
