import { createInMemoryArtifactStore } from "@/lib/storage/artifacts";
import { describe, expect, it } from "vitest";

describe("artifact store", () => {
  it("rejects Blob paths outside the ClaimLens prefix", async () => {
    const artifacts = createInMemoryArtifactStore();

    await expect(artifacts.putJpeg("other/image.jpg", Buffer.from("x")))
      .rejects.toThrow("claimlens/");
  });

  it("stores artifacts, materializes a temporary local file, and deletes a prefix", async () => {
    const artifacts = createInMemoryArtifactStore();
    const pathname = "claimlens/claims/one/image.jpg";
    const bytes = Buffer.from("jpeg-bytes");

    await artifacts.putJpeg(pathname, bytes);
    expect(await artifacts.get(pathname)).toEqual(bytes);

    await expect(
      artifacts.withLocalFile(pathname, async (localPath) => {
        return await import("node:fs/promises").then((fs) => fs.readFile(localPath));
      }),
    ).resolves.toEqual(bytes);

    await artifacts.deletePrefix("claimlens/claims/one/");
    await expect(artifacts.get(pathname)).resolves.toBeNull();
  });
});
