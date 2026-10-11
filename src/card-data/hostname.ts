const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function assertValidHostname(hostname: string): void {
  const host = hostname.toLowerCase();
  if (!host || host.length > 253) {
    throw new Error("hostname must be 1–253 characters");
  }
  if (
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.startsWith("-") ||
    host.endsWith("-")
  ) {
    throw new Error("hostname must not start or end with . or -");
  }
  if (!/^[a-z0-9.-]+$/.test(host)) {
    throw new Error(
      "hostname may only contain lowercase letters, digits, hyphens, and dots",
    );
  }
  const labels = host.split(".");
  for (const label of labels) {
    if (!label || label.length > 63) {
      throw new Error("hostname labels must be 1–63 characters");
    }
    if (!LABEL_RE.test(label)) {
      throw new Error("invalid hostname label");
    }
  }
}
