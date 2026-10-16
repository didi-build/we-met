import { readWeMetHostConfig, type WeMetHostConfig } from "@/config/we-met";
import { resolveLandingBrowseOrigin } from "@/lib/landing/urls";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";

/** Host config for marketing pages (Worker env at request time; not used at static build). */
export async function readLandingHostConfig() {
  const { env } = await getCloudflareContext({ async: true });
  return readWeMetHostConfig(env);
}

/** Same-site marketing link origin (request host on preview/local card hosts). */
export async function readLandingBrowseOrigin(config: WeMetHostConfig) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") === "http" ? "http" : "https";
  return resolveLandingBrowseOrigin(config, host, protocol);
}
