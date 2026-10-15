import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "@/email/template-renderer";

describe("email template renderer (unit)", () => {
  it("escapes HTML placeholders but not plain text", () => {
    const template = "Hello {{name}}";
    const data = { name: `<a>&"` };
    expect(renderEmailTemplate(template, data, { html: true })).toBe(
      "Hello &lt;a&gt;&amp;&quot;",
    );
    expect(renderEmailTemplate(template, data, { html: false })).toBe('Hello <a>&"');
  });

  it("treats missing values as empty", () => {
    const template = "A{{missing}}B";
    expect(renderEmailTemplate(template, {}, { html: false })).toBe("AB");
  });

  it("renders if blocks with and without else", () => {
    const template = "{{#if on}}yes{{else}}no{{/if}} | {{#if off}}yes{{/if}}";
    expect(renderEmailTemplate(template, { on: "1", off: "" }, { html: false })).toBe(
      "yes | ",
    );
  });

  it("handles nested if blocks", () => {
    const template =
      "{{#if outer}}{{#if inner}}in{{else}}out{{/if}}{{else}}empty{{/if}}";
    expect(
      renderEmailTemplate(template, { outer: "1", inner: "" }, { html: false }),
    ).toBe("out");
    expect(
      renderEmailTemplate(template, { outer: "", inner: "1" }, { html: false }),
    ).toBe("empty");
  });
});
