import { describe, expect, it } from "vitest";
import { CAMERA_IDS, CAMERA_META } from "@/lib/domain/cameras";
import { DAMAGE_REGIONS, REGION_META } from "@/lib/domain/regions";
import { REPORT_OUTCOMES } from "@/lib/domain/report";
import { CONTACT_CARDS } from "@/lib/config/contact-cards";

describe("domain/config integrity", () => {
  it("defines exactly three cameras in fixed order", () => {
    expect(CAMERA_IDS).toEqual(["entrance", "mid_tunnel", "exit"]);
    const orders = CAMERA_IDS.map((id) => CAMERA_META[id].order);
    expect(orders).toEqual([0, 1, 2]);
  });

  it("defines exactly eight normalized damage regions with metadata", () => {
    expect(DAMAGE_REGIONS).toHaveLength(8);
    for (const region of DAMAGE_REGIONS) {
      expect(REGION_META[region].id).toBe(region);
      expect(REGION_META[region].label.length).toBeGreaterThan(0);
    }
  });

  it("provides at least one contact card for every report outcome", () => {
    for (const outcome of REPORT_OUTCOMES) {
      expect(CONTACT_CARDS[outcome].length).toBeGreaterThan(0);
    }
  });
});
