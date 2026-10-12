export type HiCountryDialCode = {
  code: string;
  dial: string;
  label: string;
};

export const HI_COUNTRY_DIAL_CODES: HiCountryDialCode[] = [
  { code: "CA", dial: "+1", label: "CA +1" },
  { code: "US", dial: "+1", label: "US +1" },
  { code: "GB", dial: "+44", label: "UK +44" },
  { code: "AU", dial: "+61", label: "AU +61" },
  { code: "IN", dial: "+91", label: "IN +91" },
  { code: "EG", dial: "+20", label: "EG +20" },
  { code: "FR", dial: "+33", label: "FR +33" },
  { code: "DE", dial: "+49", label: "DE +49" },
];

export const DEFAULT_HI_COUNTRY_CODE = "CA";

export function formatHiPhone(
  countryCode: string,
  nationalNumber: string,
): string | undefined {
  const trimmed = nationalNumber.trim();
  if (!trimmed) {
    return undefined;
  }
  const country = HI_COUNTRY_DIAL_CODES.find((entry) => entry.code === countryCode);
  const dial = country?.dial ?? "+1";
  return `${dial} ${trimmed}`;
}

export function isKnownHiCountryCode(code: string): boolean {
  return HI_COUNTRY_DIAL_CODES.some((entry) => entry.code === code);
}
