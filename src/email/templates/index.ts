import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const templateDir = dirname(fileURLToPath(import.meta.url));

function loadTemplate(fileName: string): string {
  return readFileSync(join(templateDir, fileName), "utf8");
}

export const visitorFollowupTemplates = {
  html: loadTemplate("visitor-followup.html"),
  text: loadTemplate("visitor-followup.txt"),
};

export const ownerNewLeadTemplates = {
  html: loadTemplate("owner-new-lead.html"),
  text: loadTemplate("owner-new-lead.txt"),
};

export const ownerDetailsUpdateTemplates = {
  html: loadTemplate("owner-details-update.html"),
  text: loadTemplate("owner-details-update.txt"),
};
