const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;

type CompressionOptions = {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  minQuality: number;
  targetBytes: number;
  suffix: string;
};

type LoadedImage = {
  image: HTMLImageElement;
  revoke: () => void;
};

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "") || "image";
}

function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => resolve({ image, revoke: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("ไม่สามารถอ่านไฟล์รูปนี้ได้"));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("ไม่สามารถลดขนาดรูปได้"));
          return;
        }
        if (blob.type === "image/webp") {
          resolve(blob);
          return;
        }
        canvas.toBlob(
          (fallback) =>
            fallback
              ? resolve(fallback)
              : reject(new Error("ไม่สามารถลดขนาดรูปได้")),
          "image/jpeg",
          quality,
        );
      },
      "image/webp",
      quality,
    );
  });
}

export async function optimizedCanvasFile(
  canvas: HTMLCanvasElement,
  filename: string,
  options: Pick<
    CompressionOptions,
    "quality" | "minQuality" | "targetBytes" | "suffix"
  >,
) {
  let quality = options.quality;
  let blob = await canvasBlob(canvas, quality);

  while (blob.size > options.targetBytes && quality > options.minQuality) {
    quality = Math.max(options.minQuality, quality - 0.06);
    blob = await canvasBlob(canvas, quality);
  }

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${baseName(filename)}-${options.suffix}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export async function compressImageFile(
  file: File,
  options: CompressionOptions,
) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) return file;
  if (file.size > MAX_SOURCE_IMAGE_BYTES)
    throw new Error("รูปต้นฉบับต้องมีขนาดไม่เกิน 20 MB");

  const loaded = await loadImage(file);
  try {
    const scale = Math.min(
      1,
      options.maxWidth / loaded.image.naturalWidth,
      options.maxHeight / loaded.image.naturalHeight,
    );
    const width = Math.max(1, Math.round(loaded.image.naturalWidth * scale));
    const height = Math.max(1, Math.round(loaded.image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการลดขนาดรูป");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(loaded.image, 0, 0, width, height);

    const optimized = await optimizedCanvasFile(canvas, file.name, options);
    const dimensionsChanged =
      width !== loaded.image.naturalWidth || height !== loaded.image.naturalHeight;

    // Keep an already-small source when re-encoding would only make it larger.
    if (!dimensionsChanged && optimized.size >= file.size) return file;
    return optimized;
  } finally {
    loaded.revoke();
  }
}

export async function prepareDocumentFile(file: File) {
  if (file.type === "application/pdf") return file;
  return compressImageFile(file, {
    maxWidth: 2400,
    maxHeight: 2400,
    quality: 0.86,
    minQuality: 0.74,
    targetBytes: 1.5 * 1024 * 1024,
    suffix: "optimized",
  });
}
