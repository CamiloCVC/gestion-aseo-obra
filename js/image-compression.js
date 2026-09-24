const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

export function computeTargetDimensions(width, height, maxDimension = MAX_DIMENSION) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function renameToJpeg(name) {
  return name.replace(/\.[^./]+$/, "") + ".jpg";
}

export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], renameToJpeg(file.name), { type: "image/jpeg" });
}
