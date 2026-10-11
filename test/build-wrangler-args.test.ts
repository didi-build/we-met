import { describe, expect, it } from "vitest";
import {
  buildWranglerArgs,
  D1_READ_BACK_SQL,
  resolveWranglerEntry,
} from "../scripts/lib/build-wrangler-args";

describe("buildWranglerArgs (unit)", () => {
  it("resolves wrangler entry under node_modules", () => {
    expect(resolveWranglerEntry()).toMatch(/wrangler\.js$/);
  });

  it("keeps read-back SQL as a single argv element", () => {
    const args = buildWranglerArgs({
      kind: "read-back",
      configRel: "wrangler.d1-nonprod.ci.jsonc",
    });
    const commandIndex = args.indexOf("--command");
    expect(commandIndex).toBeGreaterThan(-1);
    expect(args[commandIndex + 1]).toBe(D1_READ_BACK_SQL);
    expect(args[commandIndex + 1]).toContain(",");
    expect(
      args.filter((arg) => arg.includes("SELECT") || arg.includes("slug")).length,
    ).toBe(1);
  });

  it("builds execute-file argv with expected flags", () => {
    const args = buildWranglerArgs({
      kind: "execute-file",
      configRel: "wrangler.d1-nonprod.ci.jsonc",
      remote: true,
      sqlRel: "load-12345.sql",
    });
    expect(args[0]).toBe(resolveWranglerEntry());
    expect(args).toEqual([
      resolveWranglerEntry(),
      "-c",
      "wrangler.d1-nonprod.ci.jsonc",
      "d1",
      "execute",
      "WE_MET_DB",
      "--remote",
      "--file",
      "load-12345.sql",
    ]);
  });

  it("omits -c when configRel is null (local execute)", () => {
    const args = buildWranglerArgs({
      kind: "execute-file",
      configRel: null,
      remote: false,
      sqlRel: "load-1.sql",
    });
    expect(args).not.toContain("-c");
    expect(args).toContain("--local");
  });
});
