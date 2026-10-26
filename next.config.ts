import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WE_MET_ENV: process.env.WE_MET_ENV ?? "production",
    NEXT_PUBLIC_WE_MET_BASE_URL: process.env.WE_MET_BASE_URL ?? "https://we-met.link",
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
