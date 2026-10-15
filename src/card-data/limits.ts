/** Shared card field limits for load validation and the card editor (DIDI-611). */
export const CARD_FIELD_LIMITS = {
  name: 60,
  role: 100,
  sectionTitle: 40,
  aboutParagraphs: 4,
  aboutParagraph: 500,
  services: 10,
  serviceLabel: 40,
  serviceDescription: 220,
  alternateLabel: 60,
  publicUrlMaxLength: 2048,
} as const;
