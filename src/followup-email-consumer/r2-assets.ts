import type { R2Bucket } from "@cloudflare/workers-types";
import { createR2AssetStorage } from "@/assets/r2-asset-storage";
import type { ReadOnlyR2Assets } from "@/followup-email-consumer/load-vcard-photo";

/**
 * Consumer R2 binding: read-only in code — only `get` is exposed (via asset storage).
 */
export function createReadOnlyConsumerAssets(bucket: R2Bucket): ReadOnlyR2Assets {
  const storage = createR2AssetStorage(bucket);
  return {
    async get(key: string) {
      const asset = await storage.getObject(key);
      if (!asset) {
        return null;
      }
      return {
        body: asset.body,
        contentType: asset.contentType,
      };
    },
  };
}
