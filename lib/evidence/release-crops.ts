import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Database } from "@/lib/db/connection";
import type { ArtifactStore } from "@/lib/storage/artifacts";
import type { Claim, EvidenceCrop } from "@/lib/domain/models";
import { CUSTOMER_CROP_CAMERAS } from "@/lib/domain/cameras";
import { listFindingsByClaim } from "@/lib/db/repositories/findings";
import { getFrameById, insertCrop } from "@/lib/db/repositories/evidence";
import { createRegionCrop } from "./crop";
import { newId } from "@/lib/util/id";

/** Create customer-approved crops in private Blob from local temporary files. */
export async function generateReleaseCrops(
  db: Database,
  artifacts: ArtifactStore,
  claim: Claim,
): Promise<EvidenceCrop[]> {
  const regions = new Set(claim.selectedRegions);
  const findings = (await listFindingsByClaim(db, claim.id)).filter(
    (finding) =>
      finding.region !== null &&
      regions.has(finding.region) &&
      finding.bbox !== null &&
      CUSTOMER_CROP_CAMERAS.includes(finding.camera) &&
      finding.evidenceFrameIds.length > 0,
  );

  const created: EvidenceCrop[] = [];
  for (const finding of findings) {
    const frameId = finding.evidenceFrameIds[0];
    if (!frameId || !finding.bbox || finding.region === null) continue;
    const frame = await getFrameById(db, frameId);
    if (!frame || frame.claimId !== claim.id) continue;

    const crop = await artifacts.withLocalFile(frame.storedPath, async (framePath) => {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "claimlens-crop-"));
      try {
        const outPath = path.join(directory, `${newId("crop")}.jpg`);
        const result = await createRegionCrop({ framePath, bbox: finding.bbox!, outPath });
        if (!result.ok) return null;
        const storedPath = `claimlens/crops/${claim.id}/${newId("crop")}.jpg`;
        await artifacts.putJpeg(storedPath, await fs.readFile(result.path));
        return await insertCrop(db, {
          claimId: claim.id,
          frameId: frame.id,
          camera: finding.camera,
          region: finding.region!,
          storedPath,
        });
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    });
    if (crop) created.push(crop);
  }
  return created;
}
