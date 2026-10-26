import { NON_PRODUCTION_X_ROBOTS_TAG } from "./non-production";

export type NextConfigHeaderRule = {
  source: string;
  headers: { key: string; value: string }[];
};

export function resolveNextConfigSecurityHeaders(
  weMetEnv: string,
): NextConfigHeaderRule[] {
  if (weMetEnv === "production") {
    return [];
  }
  return [
    {
      source: "/:path*",
      headers: [{ key: "X-Robots-Tag", value: NON_PRODUCTION_X_ROBOTS_TAG }],
    },
  ];
}
