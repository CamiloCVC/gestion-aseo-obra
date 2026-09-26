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

// El nombre original (capturas de pantalla, fotos de cámara, etc.) puede
// traer espacios, paréntesis o caracteres unicode que Supabase Storage
// rechaza como parte de la ruta del objeto (400 Bad Request). El nombre no
// aporta nada de valor de negocio aquí, así que se reemplaza siempre por
// uno propio, seguro y único.
function safeFileName() {
  return `${crypto.randomUUID()}.jpg`;
}

export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  if (!file.type.startsWith("image/")) {
    return new File([file], safeFileName(), { type: file.type });
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  const smaller = blob && blob.size < file.size;

  return new File([smaller ? blob : file], safeFileName(), { type: smaller ? "image/jpeg" : file.type });
}
