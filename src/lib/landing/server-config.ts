import { readWeMetHostConfig } from "@/config/we-met";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Host config for marketing pages (Worker env at request time; not used at static build). */
export async function readLandingHostConfig() {
  const { env } = await getCloudflareContext({ async: true });
  return readWeMetHostConfig(env);
}
