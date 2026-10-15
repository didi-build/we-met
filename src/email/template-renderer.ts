import { escapeHtml } from "@/email/escape";

export type EmailTemplateData = Record<string, string | undefined>;

const IF_BLOCK_PATTERN = /\{\{#if (\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/;

function isPresent(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

function renderIfBlocks(template: string, data: EmailTemplateData): string {
  let out = template;
  let prev: string;
  do {
    prev = out;
    out = out.replace(IF_BLOCK_PATTERN, (_match, key: string, body: string) => {
      const parts = body.split("{{else}}");
      const whenTrue = parts[0] ?? "";
      const whenFalse = parts[1] ?? "";
      return isPresent(data[key]) ? whenTrue : whenFalse;
    });
  } while (out !== prev);
  return out;
}

function substitutePlaceholders(
  template: string,
  data: EmailTemplateData,
  html: boolean,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === "") {
      return "";
    }
    return html ? escapeHtml(value) : value;
  });
}

export function renderEmailTemplate(
  template: string,
  data: EmailTemplateData,
  options: { html: boolean },
): string {
  const withConditionals = renderIfBlocks(template, data);
  return substitutePlaceholders(withConditionals, data, options.html);
}
