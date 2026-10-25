import type { LayoutItem, LayoutKind, Room } from "../types";
import {
  BAR_DEPTH_M,
  BAR_WIDTH_M,
  BOOTH_SIZE_M,
  BUFFET_DEPTH_M,
  BUFFET_WIDTH_M,
  DANCE_SIZE_M,
  LECTERN_SIZE_M,
  PROJECTOR_SIZE_M,
  STAGE_DEPTH_M,
  stageWidth,
  wallFromRotY,
  type Bounds,
} from "./shared";

/** Axis-aligned size in metres (w along x, d along z) at rotY = 0. */
export type FootprintSize = { w: number; d: number };

/**
 * Placement footprints (metres), the same sizes auto-layout builds with.
 * Table group includes chairs. Stage width depends on the room — see
 * footprintSize.
 */
const SIZES: Record<LayoutKind, FootprintSize> = {
  stage: { w: 8, d: STAGE_DEPTH_M }, // fallback when no room is given
  bar: { w: BAR_WIDTH_M, d: BAR_DEPTH_M },
  dance_floor: { w: DANCE_SIZE_M, d: DANCE_SIZE_M },
  dj_booth: { w: BOOTH_SIZE_M, d: BOOTH_SIZE_M },
  photo_booth: { w: BOOTH_SIZE_M, d: BOOTH_SIZE_M },
  table_round: { w: 3.2, d: 3.2 },
  high_table: { w: 3.2, d: 3.2 },
  buffet: { w: BUFFET_WIDTH_M, d: BUFFET_DEPTH_M },
  lectern: { w: LECTERN_SIZE_M, d: LECTERN_SIZE_M },
  projector: { w: PROJECTOR_SIZE_M, d: 0.2 },
  sign: { w: 0.8, d: 0.6 },
  tv: { w: 1.4, d: 0.6 },
  chair: { w: 0.5, d: 0.5 },
  guest_seated: { w: 0.4, d: 0.4 },
  guest_standing: { w: 0.4, d: 0.4 },
  guest_overflow: { w: 0.4, d: 0.4 },
};

/** Table + chairs as a single block. */
export const TABLE_GROUP_SIZE: FootprintSize = { w: 3.2, d: 3.2 };

/**
 * Size at rotY = 0. Pass the room (and the piece's rotY) for a stage so its
 * width matches the one drawn: stageWidth for the wall it backs onto.
 */
export function footprintSize(
  kind: LayoutKind,
  room?: Room,
  rotY = 0,
): FootprintSize {
  if (kind === "stage" && room) {
    return { w: stageWidth(room, wallFromRotY(rotY)), d: STAGE_DEPTH_M };
  }
  return SIZES[kind];
}

/**
 * rotY in 90° steps: odd quarters swap width and depth.
 * Intermediate angles snap to the nearest quarter-turn.
 */
export function orientedSize(
  size: FootprintSize,
  rotY: number,
): FootprintSize {
  const twoPi = Math.PI * 2;
  const norm = ((rotY % twoPi) + twoPi) % twoPi;
  const quarter = Math.round(norm / (Math.PI / 2)) % 4;
  if (quarter === 1 || quarter === 3) return { w: size.d, d: size.w };
  return { w: size.w, d: size.d };
}

/** Axis-aligned rectangle centred at (x, z). */
export function footprintBounds(
  x: number,
  z: number,
  size: FootprintSize,
  rotY = 0,
): Bounds {
  const { w, d } = orientedSize(size, rotY);
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  };
}

export function itemFootprintBounds(item: LayoutItem, room?: Room): Bounds {
  return footprintBounds(
    item.x,
    item.z,
    footprintSize(item.kind, room, item.rotY),
    item.rotY,
  );
}

export function rectsOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

export function rectInside(inner: Bounds, outer: Bounds): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  );
}
