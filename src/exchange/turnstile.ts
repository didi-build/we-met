export type TurnstileVerifier = {
  verify(token: string, remoteIp: string | null): Promise<{ success: boolean }>;
};

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileLogger = {
  logSiteverifyErrors(codes: string[]): void;
};

export function createCloudflareTurnstileVerifier(
  secretKey: string,
  logger: TurnstileLogger,
): TurnstileVerifier {
  return {
    async verify(token: string, remoteIp: string | null) {
      const body = new URLSearchParams();
      body.set("secret", secretKey);
      body.set("response", token);
      if (remoteIp) {
        body.set("remoteip", remoteIp);
      }

      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        },
      );

      if (!response.ok) {
        logger.logSiteverifyErrors([`http-${response.status}`]);
        return { success: false };
      }

      const data = (await response.json()) as SiteverifyResponse;
      if (!data.success) {
        logger.logSiteverifyErrors(data["error-codes"] ?? ["unknown"]);
      }
      return { success: data.success === true };
    },
  };
}

export function createAlwaysPassTurnstileVerifier(): TurnstileVerifier {
  return {
    async verify() {
      return { success: true };
    },
  };
}
