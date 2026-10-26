import type { NextConfig } from "next";
import { NON_PRODUCTION_X_ROBOTS_TAG } from "./src/lib/we-met/non-production";

const weMetEnv = process.env.WE_MET_ENV ?? "production";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WE_MET_ENV: weMetEnv,
    NEXT_PUBLIC_WE_MET_COMMIT_SHA: process.env.WE_MET_COMMIT_SHA?.trim() ?? "",
  },
  async headers() {
    if (weMetEnv === "production") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: NON_PRODUCTION_X_ROBOTS_TAG }],
      },
    ];
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
