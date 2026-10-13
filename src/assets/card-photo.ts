export const CARD_PHOTO_JPEG_CONTENT_TYPE = "image/jpeg";

export const ROUTE_NOT_FOUND_CACHE_CONTROL = "no-store";

export function notFoundRouteResponse(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": ROUTE_NOT_FOUND_CACHE_CONTROL },
  });
}

export function logNonJpegCardPhoto(slug: string, photoKey: string): void {
  console.error(`card photo: expected image/jpeg slug=${slug} key=${photoKey}`);
}
