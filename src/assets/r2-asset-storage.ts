import type { R2Bucket } from "@cloudflare/workers-types";
import type { AssetStorage, StoredAsset } from "@/assets/types";

export function createR2AssetStorage(bucket: R2Bucket): AssetStorage {
  return {
    async getObject(key: string): Promise<StoredAsset | null> {
      const object = await bucket.get(key);
      if (!object) {
        return null;
      }
      const body = object.body;
      if (!body) {
        return null;
      }
      const contentType =
        object.httpMetadata?.contentType ?? "application/octet-stream";
      return {
        body: body as ReadableStream<Uint8Array>,
        contentType,
        size: object.size,
      };
    },
  };
}
