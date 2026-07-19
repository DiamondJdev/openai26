import { describe, expect, it, vi } from "vitest";
import {
  compressCustomerImage,
  CUSTOMER_IMAGE_MAX_BYTES,
  ImageCompressionError,
  type ImageDecoder,
} from "@/lib/client/image-compression";

function file(name = "photo.png"): File {
  return new File(["source"], name, { type: "image/png" });
}

function bytes(size: number): Blob {
  return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
}

function fakeDecoder(outputSizes: readonly number[]): {
  decoder: ImageDecoder;
  encode: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn();
  let outputIndex = 0;
  const encode = vi.fn(async (width: number, height: number, quality: number) => {
    void width;
    void height;
    void quality;
    const outputSize =
      outputSizes[outputIndex] ?? CUSTOMER_IMAGE_MAX_BYTES + 1;
    outputIndex += 1;
    return bytes(outputSize);
  });
  const decoder = vi.fn(async () => ({
    width: 3024,
    height: 4032,
    encode,
    release,
  }));
  return { decoder, encode, release };
}

describe("compressCustomerImage", () => {
  it("returns a bounded JPEG after scaling a large portrait image", async () => {
    const fake = fakeDecoder([200 * 1024]);

    const result = await compressCustomerImage(file(), fake.decoder);

    expect(result).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
    expect(result.size).toBeLessThanOrEqual(CUSTOMER_IMAGE_MAX_BYTES);
    expect(fake.decoder).toHaveBeenCalledOnce();
    expect(fake.encode).toHaveBeenCalledWith(768, 1024, 0.45);
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it("retries smaller candidates before returning a compressed file", async () => {
    const fake = fakeDecoder([
      CUSTOMER_IMAGE_MAX_BYTES + 1,
      200 * 1024,
    ]);

    await expect(compressCustomerImage(file(), fake.decoder)).resolves.toMatchObject({
      type: "image/jpeg",
    });

    expect(fake.encode).toHaveBeenCalledTimes(2);
    expect(fake.encode.mock.calls).toEqual([
      [768, 1024, 0.45],
      [768, 1024, 0.35],
    ]);
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it("fails instead of returning the original file when no candidate fits", async () => {
    const fake = fakeDecoder([]);

    await expect(compressCustomerImage(file(), fake.decoder)).rejects.toBeInstanceOf(
      ImageCompressionError,
    );

    expect(fake.release).toHaveBeenCalledOnce();
  });
});
