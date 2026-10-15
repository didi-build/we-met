export type CropState = {
  x: number;
  y: number;
  z: number;
  base: number;
  w: number;
  h: number;
  S: number;
};

export function cropBaseScale(
  stageSize: number,
  imageWidth: number,
  imageHeight: number,
): number {
  return Math.max(stageSize / imageWidth, stageSize / imageHeight);
}

export function clampCrop(crop: CropState): CropState {
  const k = crop.base * crop.z;
  const mx = Math.max(0, (crop.w * k - crop.S) / 2);
  const my = Math.max(0, (crop.h * k - crop.S) / 2);
  return {
    ...crop,
    x: Math.max(-mx, Math.min(mx, crop.x)),
    y: Math.max(-my, Math.min(my, crop.y)),
  };
}

/** Source rectangle in natural image pixels for a square crop. */
export function cropSourceRect(crop: CropState): {
  sx: number;
  sy: number;
  sSize: number;
} {
  const k = crop.base * crop.z;
  const left = crop.S / 2 + crop.x - (crop.w * k) / 2;
  const top = crop.S / 2 + crop.y - (crop.h * k) / 2;
  const sSize = crop.S / k;
  return {
    sx: -left / k,
    sy: -top / k,
    sSize,
  };
}

export const CROP_OUTPUT_SIZE = 512;

/** Renders a square JPEG blob from a loaded image and crop state (512×512, quality 0.9). */
export function renderCroppedPhotoJpeg(
  image: CanvasImageSource,
  crop: CropState,
  quality = 0.9,
): Promise<Blob> {
  const { sx, sy, sSize } = cropSourceRect(crop);
  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas not available"));
  }
  ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}
