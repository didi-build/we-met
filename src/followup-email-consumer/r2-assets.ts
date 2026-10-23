import type { R2Bucket } from "@cloudflare/workers-types";
import { createReadOnlyR2Assets } from "@/assets/read-only-r2-assets";
import type { ReadOnlyR2Assets } from "@/lib/hi/build-owner-vcard";

/**
 * Consumer R2 binding: read-only in code — only `get` is exposed (via asset storage).
 */
export function createReadOnlyConsumerAssets(bucket: R2Bucket): ReadOnlyR2Assets {
  return createReadOnlyR2Assets(bucket);
}
