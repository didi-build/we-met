import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createR2AssetStorage } from "@/assets/r2-asset-storage";
import type { AssetStorage } from "@/assets/types";

export async function getAssetStorage(): Promise<AssetStorage> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.WE_MET_ASSETS) {
    throw new Error("WE_MET_ASSETS binding is not configured");
  }
  return createR2AssetStorage(env.WE_MET_ASSETS);
}
