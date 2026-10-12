export type HiExchangePayload = {
  slug: string;
  name: string;
  email: string;
  phone?: string;
  turnstileToken: string;
  website?: string;
};

export type HiDetailsPayload = {
  token: string;
  jobTitle?: string;
  company?: string;
  note?: string;
};

export const HI_EXCHANGE_REQUEST_TIMEOUT_MS = 15_000;

export type HiExchangeFailureKind = "server" | "network" | "timeout";

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function postHiExchange(
  payload: HiExchangePayload,
): Promise<
  | { ok: true; token: string }
  | { ok: false; kind: HiExchangeFailureKind; message?: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HI_EXCHANGE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await readJsonResponse(response)) as {
      ok?: boolean;
      token?: string;
      error?: string;
    } | null;

    if (!response.ok) {
      return { ok: false, kind: "server", message: data?.error };
    }
    return { ok: true, token: data?.token ?? "" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, kind: "timeout" };
    }
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function postHiDetails(
  payload: HiDetailsPayload,
): Promise<
  { ok: true } | { ok: false; kind: HiExchangeFailureKind; message?: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HI_EXCHANGE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/details", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = (await readJsonResponse(response)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!response.ok) {
      return {
        ok: false,
        kind: "server",
        message: data?.error ?? "Something went wrong. Please try again.",
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, kind: "timeout" };
    }
    return { ok: false, kind: "network" };
  } finally {
    clearTimeout(timeout);
  }
}
