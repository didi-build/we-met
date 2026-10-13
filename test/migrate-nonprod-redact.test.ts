import { describe, expect, it } from "vitest";
import { redactMigrationLog } from "../scripts/migrate-nonprod/redact.mjs";

describe("redactMigrationLog (unit)", () => {
  it("redacts UUIDs and 32-char hex ids", () => {
    const input =
      "database_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa and uuid=11111111-1111-4111-8111-111111111111";
    const out = redactMigrationLog(input);
    expect(out).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(out).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(out).toContain("[redacted-id]");
    expect(out).toContain("[redacted-uuid]");
  });
});
