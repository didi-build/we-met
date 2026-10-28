/** Status class written to Workers Analytics Engine for POST /api/exchange (no PII). */
export type ExchangeOutcomeStatusClass =
  "2xx" | "4xx" | "429" | "5xx" | "kill-switch 503";

const EXCHANGE_OUTCOME_INDEX = "exchange_outcome";

export function exchangeOutcomeStatusClassFromHttp(
  status: number,
  errorCode?: string,
): ExchangeOutcomeStatusClass {
  if (status === 429) {
    return "429";
  }
  if (status === 503 && errorCode === "lead_email_unavailable") {
    return "kill-switch 503";
  }
  if (status >= 500) {
    return "5xx";
  }
  if (status >= 400) {
    return "4xx";
  }
  return "2xx";
}

function readErrorCodeFromJsonBody(body: unknown): string | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" ? error : undefined;
}

/**
 * Records one exchange_outcome datapoint. Never throws; exchange responses must not depend on AE.
 */
export function writeExchangeOutcomeDataPoint(
  env: CloudflareEnv,
  statusClass: ExchangeOutcomeStatusClass,
): void {
  const dataset = env.WE_MET_EXCHANGE_OUTCOME_ANALYTICS;
  if (!dataset) {
    return;
  }
  try {
    dataset.writeDataPoint({
      indexes: [EXCHANGE_OUTCOME_INDEX],
      blobs: [statusClass],
      doubles: [1],
    });
  } catch {
    // Analytics must not affect exchange availability.
  }
}

/** Parses a JSON error Response and writes the outcome datapoint when applicable. */
export async function recordExchangeOutcomeFromResponse(
  env: CloudflareEnv,
  response: Response,
): Promise<void> {
  let errorCode: string | undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      errorCode = readErrorCodeFromJsonBody(body);
    } catch {
      errorCode = undefined;
    }
  }
  writeExchangeOutcomeDataPoint(
    env,
    exchangeOutcomeStatusClassFromHttp(response.status, errorCode),
  );
}
