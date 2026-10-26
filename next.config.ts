import type { NextConfig } from "next";
import { resolveNextConfigSecurityHeaders } from "./src/lib/we-met/next-config-headers";

const weMetEnv = process.env.WE_MET_ENV ?? "production";
if (weMetEnv === "staging" && !process.env.WE_MET_BASE_URL?.trim()) {
  throw new Error("WE_MET_BASE_URL is required when WE_MET_ENV is staging");
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WE_MET_ENV: weMetEnv,
    NEXT_PUBLIC_WE_MET_BASE_URL: process.env.WE_MET_BASE_URL ?? "https://we-met.link",
    NEXT_PUBLIC_WE_MET_COMMIT_SHA: process.env.WE_MET_COMMIT_SHA?.trim() ?? "",
  },
  async headers() {
    return resolveNextConfigSecurityHeaders(weMetEnv);
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
