import path from "node:path";
import type { DB } from "@/lib/db/connection";
import type { Claim, EvidenceCrop } from "@/lib/domain/models";
import { CUSTOMER_CROP_CAMERAS } from "@/lib/domain/cameras";
import { listFindingsByClaim } from "@/lib/db/repositories/findings";
import { getFrameById, insertCrop } from "@/lib/db/repositories/evidence";
import { createRegionCrop } from "./crop";
import { newId } from "@/lib/util/id";

/**
 * Generate focused, timestamped entrance/exit crops for the claim's selected
 * regions from findings that carry a vision-localized bbox. Only produces a crop
 * when a usable one can be created — if none can, the customer simply sees no
 * photos (they are never fabricated). Returns the crops that were created.
 */
export async function generateReleaseCrops(
  db: DB,
  claim: Claim,
  cropsDir: string,
): Promise<EvidenceCrop[]> {
  const regions = new Set(claim.selectedRegions);
  const findings = listFindingsByClaim(db, claim.id).filter(
    (f) =>
      f.region !== null &&
      regions.has(f.region) &&
      f.bbox !== null &&
      CUSTOMER_CROP_CAMERAS.includes(f.camera) &&
      f.evidenceFrameIds.length > 0,
  );

  const created: EvidenceCrop[] = [];
  for (const finding of findings) {
    const frameId = finding.evidenceFrameIds[0];
    if (!frameId || !finding.bbox || finding.region === null) continue;
    const frame = getFrameById(db, frameId);
    if (!frame || frame.claimId !== claim.id) continue;

    const outPath = path.join(
      cropsDir,
      `${claim.id}-${finding.region}-${finding.camera}-${newId()}.jpg`,
    );
    const result = await createRegionCrop({
      framePath: frame.storedPath,
      bbox: finding.bbox,
      outPath,
    });
    if (!result.ok) continue;

    created.push(
      insertCrop(db, {
        claimId: claim.id,
        frameId: frame.id,
        camera: finding.camera,
        region: finding.region,
        storedPath: result.path,
      }),
    );
  }
  return created;
}
