import type { CardRecord } from "@/card-data/types";
import { buildVCard } from "@/lib/hi/vcard";

/**
 * Client-side vCard download for the visitor confirmation screen (DIDI-742).
 * TODO(Developer): Replace with token-gated POST when the public download route ships.
 */
export function downloadOwnerVCard(card: CardRecord): void {
  const body = buildVCard(card.contact, { ownerEmail: card.email });
  const blob = new Blob([body], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName =
    card.contact.name.full
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-") || "contact";
  anchor.href = url;
  anchor.download = `${safeName}.vcf`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
