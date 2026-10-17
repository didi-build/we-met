import type { ContactName } from "@/card-data/types";

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Signature and preview text: given, optional (nickname), optional family. */
export function ownerEmailDisplayName(name: ContactName): string {
  const given = collapseSpaces(name.given);
  const family = collapseSpaces(name.family);
  const nickname = collapseSpaces(name.nickname);

  const showNickname =
    nickname.length > 0 && nickname.toLowerCase() !== given.toLowerCase();

  const parts: string[] = [];
  parts.push(showNickname ? `${given} (${nickname})` : given);
  if (family.length > 0) {
    parts.push(family);
  }
  return collapseSpaces(parts.join(" "));
}
