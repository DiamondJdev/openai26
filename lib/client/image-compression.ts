export const CUSTOMER_IMAGE_MAX_BYTES = 350 * 1024;

const MAX_DIMENSIONS = [1024, 768, 640, 512] as const;
const JPEG_QUALITIES = [0.45, 0.35, 0.25] as const;

export class ImageCompressionError extends Error {
  constructor(message = "That photo could not be compressed. Please retake it.") {
    super(message);
    this.name = "ImageCompressionError";
  }
}

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  encode(width: number, height: number, quality: number): Promise<Blob | null>;
  release(): void;
}

export type ImageDecoder = (file: File) => Promise<DecodedImage>;

interface CompressionCandidate {
  readonly width: number;
  readonly height: number;
  readonly quality: number;
}

function jpegFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}.jpg`;
}

function dimensionsFor(width: number, height: number, maxDimension: number): {
  width: number;
  height: number;
} {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function compressionCandidates(width: number, height: number): CompressionCandidate[] {
  const candidates: CompressionCandidate[] = [];
  for (const [dimensionIndex, maxDimension] of MAX_DIMENSIONS.entries()) {
    const dimensions = dimensionsFor(width, height, maxDimension);
    const qualities = dimensionIndex === 0 ? JPEG_QUALITIES : [0.25];
    for (const quality of qualities) {
      candidates.push({ ...dimensions, quality });
    }
  }
  return candidates;
}

function toJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

/** Decode an image with a browser object URL and render JPEG candidates on canvas. */
export function decodeBrowserImage(file: File): Promise<DecodedImage> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.reject(new ImageCompressionError());
  }

  const sourceUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        URL.revokeObjectURL(sourceUrl);
        reject(new ImageCompressionError());
        return;
      }

      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        async encode(width, height, quality) {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) throw new ImageCompressionError();
          context.drawImage(image, 0, 0, width, height);
          return await toJpegBlob(canvas, quality);
        },
        release() {
          URL.revokeObjectURL(sourceUrl);
        },
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new ImageCompressionError());
    };
    image.src = sourceUrl;
  });
}

/**
 * Re-encode a customer photo locally before upload. The original file is never
 * returned: callers either receive a bounded JPEG or a retryable error.
 */
export async function compressCustomerImage(
  file: File,
  decode: ImageDecoder = decodeBrowserImage,
): Promise<File> {
  let image: DecodedImage;
  try {
    image = await decode(file);
  } catch (error) {
    if (error instanceof ImageCompressionError) throw error;
    throw new ImageCompressionError();
  }

  try {
    for (const candidate of compressionCandidates(image.width, image.height)) {
      let blob: Blob | null;
      try {
        blob = await image.encode(
          candidate.width,
          candidate.height,
          candidate.quality,
        );
      } catch {
        throw new ImageCompressionError();
      }
      if (blob && blob.size <= CUSTOMER_IMAGE_MAX_BYTES) {
        return new File([blob], jpegFileName(file.name), {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }
    throw new ImageCompressionError();
  } finally {
    image.release();
  }
}
