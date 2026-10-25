import type { LayoutItem, LayoutKind } from "../types";
import type { Bounds } from "./shared";

/** Axis-aligned size in metres (w along x, d along z) at rotY = 0. */
export type FootprintSize = { w: number; d: number };

/** Placement footprints (metres). Table group includes chairs. */
const SIZES: Record<LayoutKind, FootprintSize> = {
  stage: { w: 8, d: 3 },
  bar: { w: 6, d: 1.2 },
  dance_floor: { w: 6, d: 6 },
  dj_booth: { w: 2, d: 1.5 },
  photo_booth: { w: 2, d: 2 },
  table_round: { w: 3.2, d: 3.2 },
  high_table: { w: 3.2, d: 3.2 },
  buffet: { w: 4.8, d: 0.9 },
  lectern: { w: 0.7, d: 0.7 },
  projector: { w: 2.2, d: 0.2 },
  chair: { w: 0.5, d: 0.5 },
  guest_seated: { w: 0.4, d: 0.4 },
  guest_standing: { w: 0.4, d: 0.4 },
  guest_overflow: { w: 0.4, d: 0.4 },
};

/** Table + chairs as a single block. */
export const TABLE_GROUP_SIZE: FootprintSize = { w: 3.2, d: 3.2 };

export function footprintSize(kind: LayoutKind): FootprintSize {
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

export function itemFootprintBounds(item: LayoutItem): Bounds {
  return footprintBounds(item.x, item.z, footprintSize(item.kind), item.rotY);
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
