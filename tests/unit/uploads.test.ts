import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateAndReencode } from "@/lib/uploads/validate";
import { buildAppHarness, jpegBuffer } from "../helpers/app";
import { createClaim } from "@/lib/claims/create";
import { submitIntake } from "@/lib/claims/customer";
import { listUploadsByClaim } from "@/lib/db/repositories/uploads";

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .png()
    .toBuffer();
}

describe("validateAndReencode", () => {
  it("accepts a valid image and re-encodes it to JPEG", async () => {
    const result = await validateAndReencode(await png(200, 150));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.mime).toBe("image/jpeg");
    expect(result.image.width).toBe(200);
    expect(result.image.height).toBe(150);
    expect(result.image.bytes).toBe(result.image.data.length);
    expect(result.image.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a non-image buffer", async () => {
    const result = await validateAndReencode(Buffer.from("definitely not an image"));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty buffer", async () => {
    const result = await validateAndReencode(Buffer.alloc(0));
    expect(result.ok).toBe(false);
  });

  it("rejects images that exceed the max dimension", async () => {
    const result = await validateAndReencode(await png(6000, 10), {
      maxDimension: 5000,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects images below the min dimension", async () => {
    const result = await validateAndReencode(await png(10, 10), {
      minDimension: 32,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects buffers larger than the byte cap", async () => {
    const result = await validateAndReencode(await png(200, 150), {
      maxBytes: 10,
    });
    expect(result.ok).toBe(false);
  });

  it("strips metadata (re-encoded output has no EXIF)", async () => {
    const withExif = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#fff" },
    })
      .withExif({ IFD0: { Copyright: "SECRET-OWNER" } })
      .jpeg()
      .toBuffer();
    const result = await validateAndReencode(withExif);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = await sharp(result.image.data).metadata();
    expect(meta.exif).toBeUndefined();
  });
});

describe("customer upload persistence", () => {
  it("persists a validated intake image under the private uploads prefix", async () => {
    const h = await buildAppHarness();
    try {
      const { claim } = await createClaim(h.ctx, {
        plate: "TEST-123",
        managerNote: "rear bumper",
      });
      const image = await jpegBuffer();

      await submitIntake(h.ctx, claim.id, {
        name: "Jordan Doe",
        email: "jordan@example.com",
        phone: "555-123-4567",
        consent: true,
        files: [
          { kind: "plate", bytes: image },
          { kind: "odometer", bytes: image },
          { kind: "insurance", bytes: image },
        ],
      });

      const uploads = await listUploadsByClaim(h.ctx.db, claim.id);
      expect(uploads.map((upload) => upload.storedPath)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^claimlens\/uploads\//),
        ]),
      );
    } finally {
      await h.cleanup();
    }
  });
});
