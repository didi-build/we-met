/** Shared field limits for exchange/details API validation and the card UI. */
export const EXCHANGE_LIMITS = {
  slug: 48,
  name: 100,
  email: 254,
  /** Full phone string from the client (`<dial> <national>`); server validates this length. */
  phone: 40,
  /** National number only (input `maxLength`); dial prefix is added client-side before submit. */
  phoneNational: 30,
  jobTitle: 100,
  company: 100,
  note: 1000,
  turnstileToken: 2048,
} as const;
