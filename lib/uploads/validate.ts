import { createHash } from "node:crypto";
import sharp from "sharp";
import { UPLOAD_LIMITS } from "@/lib/config/constants";

export interface ValidatedImage {
  readonly data: Buffer;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
}

export type UploadValidation =
  | { readonly ok: true; readonly image: ValidatedImage }
  | { readonly ok: false; readonly error: string };

export interface UploadLimits {
  maxBytes: number;
  maxDimension: number;
  minDimension: number;
  allowedFormats: readonly string[];
}

const DEFAULT_LIMITS: UploadLimits = {
  maxBytes: UPLOAD_LIMITS.maxBytes,
  maxDimension: UPLOAD_LIMITS.maxDimension,
  minDimension: UPLOAD_LIMITS.minDimension,
  allowedFormats: ["jpeg", "png", "webp"],
};

const REJECT = "That image could not be accepted. Try a JPG or PNG photo.";

/**
 * Validate an uploaded image at the system boundary and re-encode it to a clean
 * JPEG with all metadata stripped. Never trusts the declared content type — the
 * real format is sniffed by sharp. Returns a discriminated result rather than
 * throwing so callers can surface a friendly error.
 */
export async function validateAndReencode(
  input: Buffer,
  overrides: Partial<UploadLimits> = {},
): Promise<UploadValidation> {
  const limits = { ...DEFAULT_LIMITS, ...overrides };

  if (input.length === 0) return { ok: false, error: REJECT };
  if (input.length > limits.maxBytes) return { ok: false, error: REJECT };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return { ok: false, error: REJECT };
  }

  const format = meta.format ?? "";
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!limits.allowedFormats.includes(format)) {
    return { ok: false, error: REJECT };
  }
  if (width < limits.minDimension || height < limits.minDimension) {
    return { ok: false, error: REJECT };
  }
  if (width > limits.maxDimension || height > limits.maxDimension) {
    return { ok: false, error: REJECT };
  }

  let data: Buffer;
  try {
    // Rotate per EXIF orientation, then drop all metadata by re-encoding.
    data = await sharp(input)
      .rotate()
      .jpeg({ quality: UPLOAD_LIMITS.reencodeQuality, mozjpeg: true })
      .toBuffer();
  } catch {
    return { ok: false, error: REJECT };
  }

  const out = await sharp(data).metadata();

  return {
    ok: true,
    image: {
      data,
      mime: "image/jpeg",
      width: out.width ?? width,
      height: out.height ?? height,
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    },
  };
}
