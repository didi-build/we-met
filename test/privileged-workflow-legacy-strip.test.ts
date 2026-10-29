import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectStaticModuleSpecifiers,
  stripJsComments,
} from "../scripts/lib/privileged-workflow-import-walk.mjs";

const resolutionFixtureRoot = join(
  "test/fixtures/privileged-workflow-import-walk/resolution",
);

/**
 * Hand lexer from we-met PR 137 at 8b6f08d (QA round 2 baseline).
 * @param {string} content
 */
function legacyStripJsComments(content: string) {
  /** @type {string[]} */
  const parts = [];
  let i = 0;
  /** @type {"'" | '"' | "`" | null} */
  let inString = null;
  let inRegex = false;
  let inRegexClass = false;
  /** @type {string | undefined} */
  let prevNonWs = undefined;

  function isRegexLiteralStart(prevNonWsInner: string | undefined) {
    return (
      prevNonWsInner === undefined ||
      prevNonWsInner === "\n" ||
      prevNonWsInner === "\r" ||
      prevNonWsInner === "(" ||
      prevNonWsInner === "[" ||
      prevNonWsInner === "{" ||
      prevNonWsInner === "," ||
      prevNonWsInner === "=" ||
      prevNonWsInner === ":" ||
      prevNonWsInner === ";" ||
      prevNonWsInner === "!" ||
      prevNonWsInner === "?" ||
      prevNonWsInner === "|" ||
      prevNonWsInner === "&" ||
      prevNonWsInner === "+" ||
      prevNonWsInner === "-" ||
      prevNonWsInner === "*" ||
      prevNonWsInner === "~" ||
      prevNonWsInner === "^" ||
      prevNonWsInner === "/"
    );
  }

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (inRegex) {
      parts.push(ch);
      if (inRegexClass) {
        if (ch === "\\" && i + 1 < content.length) {
          parts.push(content[i + 1]);
          i += 2;
          continue;
        }
        if (ch === "]") {
          inRegexClass = false;
        }
        i++;
        continue;
      }
      if (ch === "\\" && i + 1 < content.length) {
        parts.push(content[i + 1]);
        i += 2;
        continue;
      }
      if (ch === "[") {
        inRegexClass = true;
        i++;
        continue;
      }
      if (ch === "/") {
        inRegex = false;
        i++;
        while (i < content.length && /[gimsuy]/.test(content[i])) {
          parts.push(content[i]);
          i++;
        }
        prevNonWs = "/";
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      parts.push(ch);
      if (ch === "\\" && i + 1 < content.length) {
        parts.push(content[i + 1]);
        i += 2;
        continue;
      }
      if (ch === inString) {
        inString = null;
        prevNonWs = ch;
      }
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      inString = ch;
      parts.push(ch);
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      i += 2;
      while (i < content.length && content[i] !== "\n") {
        i++;
      }
      parts.push(" ");
      prevNonWs = " ";
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) {
        i++;
      }
      i += 2;
      parts.push(" ");
      prevNonWs = " ";
      continue;
    }

    if (ch === "/" && isRegexLiteralStart(prevNonWs)) {
      inRegex = true;
      inRegexClass = false;
      parts.push(ch);
      i++;
      continue;
    }

    parts.push(ch);
    if (!/\s/.test(ch)) {
      prevNonWs = ch;
    }
    i++;
  }
  return parts.join("");
}

describe("legacy hand lexer (8b6f08d) vs TypeScript scanner", () => {
  it("single-quoted http URL fixture: TS strip preserves import (legacy strip differs)", () => {
    const content = readFileSync(
      `${resolutionFixtureRoot}/entry-regex-literal.mjs`,
      "utf8",
    );
    const tsStripped = stripJsComments(content, "entry-regex-literal.mjs");
    const legacyStripped = legacyStripJsComments(content);
    expect(tsStripped).toContain("const u = 'http:" + "//a'");
    expect(tsStripped).toContain('import "./after-regex.mjs"');
    expect(legacyStripped).not.toEqual(tsStripped);
    expect(collectStaticModuleSpecifiers(content, "entry-regex-literal.mjs")).toContain(
      "./after-regex.mjs",
    );
  });

  it("/[/']/ regex class fixture: TS strip preserves import (legacy strip differs)", () => {
    const content = readFileSync(
      `${resolutionFixtureRoot}/entry-regex-char-class.mjs`,
      "utf8",
    );
    const tsStripped = stripJsComments(content, "entry-regex-char-class.mjs");
    const legacyStripped = legacyStripJsComments(content);
    expect(tsStripped).toContain('import "./after-regex-char.mjs"');
    expect(legacyStripped).not.toEqual(tsStripped);
    expect(
      collectStaticModuleSpecifiers(content, "entry-regex-char-class.mjs"),
    ).toContain("./after-regex-char.mjs");
  });

  it("apply.ts-shaped nested template fixture: TS finds import", () => {
    const content = readFileSync(
      `${resolutionFixtureRoot}/entry-apply-template-shape.mjs`,
      "utf8",
    );
    expect(
      collectStaticModuleSpecifiers(content, "entry-apply-template-shape.mjs"),
    ).toContain("./after-apply-shape.mjs");
  });

  it("scripts/migrate-nonprod/apply.ts: TS preProcess finds repo imports", () => {
    const content = readFileSync("scripts/migrate-nonprod/apply.ts", "utf8");
    expect(
      collectStaticModuleSpecifiers(content, "scripts/migrate-nonprod/apply.ts"),
    ).toContain("./comment-body.mjs");
  });
});
