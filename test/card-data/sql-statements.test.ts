import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "@/card-data/sql-statements";

describe("splitSqlStatements (unit)", () => {
  it("does not split on semicolons inside string literals", () => {
    const sql = "SELECT 'a;b'; SELECT 1;";
    expect(splitSqlStatements(sql)).toEqual(["SELECT 'a;b'", "SELECT 1"]);
  });

  it("skips -- line comments", () => {
    const sql = "SELECT 1; -- comment with ; semicolon\nSELECT 2;";
    expect(splitSqlStatements(sql)).toEqual(["SELECT 1", "SELECT 2"]);
  });
});
