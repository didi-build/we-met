const RESERVED_HOST_LABELS = new Set(["app", "www", "api"]);

export function isReservedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  const firstLabel = host.split(".")[0];
  return RESERVED_HOST_LABELS.has(firstLabel);
}
