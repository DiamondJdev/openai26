/**
 * Exactly three fixed cameras in a known order. There is no vehicle tracking:
 * given an incident timestamp you pull the clip near it from each feed and let
 * vision confirm the same vehicle. Camera ids are a closed set — the agent may
 * never reference a camera outside this list.
 */
export const CAMERA_IDS = ["entrance", "mid_tunnel", "exit"] as const;

export type CameraId = (typeof CAMERA_IDS)[number];

export interface CameraMeta {
  readonly id: CameraId;
  readonly label: string;
  /** Fixed position order along the wash. */
  readonly order: number;
  /** Which before/after phase this camera captures, if any. */
  readonly phase: "entrance" | "mid" | "exit";
}

export const CAMERA_META: Readonly<Record<CameraId, CameraMeta>> = {
  entrance: { id: "entrance", label: "Entrance", order: 0, phase: "entrance" },
  mid_tunnel: { id: "mid_tunnel", label: "Mid-tunnel", order: 1, phase: "mid" },
  exit: { id: "exit", label: "Exit", order: 2, phase: "exit" },
};

/** Cameras whose focused crops may be shared with the customer (before/after). */
export const CUSTOMER_CROP_CAMERAS: readonly CameraId[] = ["entrance", "exit"];

export function isCameraId(value: unknown): value is CameraId {
  return (
    typeof value === "string" &&
    (CAMERA_IDS as readonly string[]).includes(value)
  );
}
