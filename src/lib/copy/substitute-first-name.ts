const TOKEN = "{firstName}";

/** Substitute `{firstName}` without trimming the template (prefix/suffix spaces are intentional). */
export function substituteFirstName(template: string, firstName: string): string {
  return template.replaceAll(TOKEN, firstName);
}
