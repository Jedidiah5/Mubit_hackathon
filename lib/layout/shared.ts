import type { LayoutItem, Room, Spec, Wall } from "../types";

/** Origin at room centre. +x = east, −z = north, +z = south. */

export const TABLE_DIAMETER_M = 1.8;
export const TABLE_RADIUS_M = TABLE_DIAMETER_M / 2;
export const TABLE_SPACING_M = 3;
export const CHAIRS_PER_ROUND = 10;
export const CHAIR_RADIUS_M = TABLE_RADIUS_M + 0.55;
export const AISLE_ACCESSIBLE_M = 1.5;
export const AISLE_DEFAULT_M = 0.8;
export const THEATRE_AISLE_M = 1.2;
export const STAGE_DEPTH_M = 2.4;
export const STAGE_WIDTH_FRAC = 0.55;
export const BAR_DEPTH_M = 1.2;
export const BAR_WIDTH_M = 3.5;
export const DANCE_SIZE_M = 6;
export const BOOTH_SIZE_M = 1.6;
export const LECTERN_SIZE_M = 0.7;
export const PROJECTOR_SIZE_M = 2.2;

export type Bounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function aisleMargin(accessible: boolean): number {
  return accessible ? AISLE_ACCESSIBLE_M : AISLE_DEFAULT_M;
}

export function halfExtents(room: Room): { hx: number; hz: number } {
  return { hx: room.widthM / 2, hz: room.lengthM / 2 };
}

export function wallNormal(wall: Wall): { x: number; z: number } {
  switch (wall) {
    case "north":
      return { x: 0, z: -1 };
    case "south":
      return { x: 0, z: 1 };
    case "east":
      return { x: 1, z: 0 };
    case "west":
      return { x: -1, z: 0 };
    default:
      return { x: 0, z: 0 };
  }
}

/** Yaw so +z local faces into the room from that wall. */
export function wallFacingIn(wall: Wall): number {
  switch (wall) {
    case "north":
      return 0;
    case "south":
      return Math.PI;
    case "east":
      return Math.PI / 2;
    case "west":
      return -Math.PI / 2;
    default:
      return 0;
  }
}

export function item(
  kind: LayoutItem["kind"],
  x: number,
  z: number,
  rotY = 0,
): LayoutItem {
  return { kind, x, z, rotY };
}

/** Centre-front of the room (just inboard of the stage). */
export function danceFloorPosition(
  room: Room,
  spec: Spec,
): { x: number; z: number } {
  const { hx, hz } = halfExtents(room);
  const stageWall: Wall = spec.stage === "none" ? "north" : spec.stage;
  const n = wallNormal(stageWall);
  const margin = aisleMargin(spec.accessible);
  const inset = STAGE_DEPTH_M + DANCE_SIZE_M / 2 + margin * 0.5;
  let x = -n.x * Math.min(inset, Math.max(hx, hz) * 0.35);
  let z = -n.z * Math.min(inset, Math.max(hx, hz) * 0.35);
  // Keep the pad inside the floor.
  const half = DANCE_SIZE_M / 2;
  x = Math.max(-hx + half + 0.2, Math.min(hx - half - 0.2, x));
  z = Math.max(-hz + half + 0.2, Math.min(hz - half - 0.2, z));
  return { x, z };
}

/** Usable floor after wall clearance and reserved stage / bar strips. */
export function seatingBounds(
  room: Room,
  spec: Spec,
  opts: { reserveDance?: boolean } = {},
): Bounds {
  const { hx, hz } = halfExtents(room);
  const margin = aisleMargin(spec.accessible);
  let minX = -hx + margin;
  let maxX = hx - margin;
  let minZ = -hz + margin;
  let maxZ = hz - margin;

  const reserve = (wall: Wall, depth: number) => {
    if (wall === "none") return;
    switch (wall) {
      case "north":
        minZ = Math.max(minZ, -hz + depth + margin);
        break;
      case "south":
        maxZ = Math.min(maxZ, hz - depth - margin);
        break;
      case "east":
        maxX = Math.min(maxX, hx - depth - margin);
        break;
      case "west":
        minX = Math.max(minX, -hx + depth + margin);
        break;
    }
  };

  if (spec.stage !== "none") reserve(spec.stage, STAGE_DEPTH_M);
  if (spec.bar !== "none") reserve(spec.bar, BAR_DEPTH_M);

  if (opts.reserveDance !== false && spec.extras.includes("dance_floor")) {
    const dance = danceFloorPosition(room, spec);
    const half = DANCE_SIZE_M / 2 + 0.6;
    // Shrink free bounds away from the dance pad (keep the larger remaining band).
    const stageWall: Wall = spec.stage === "none" ? "north" : spec.stage;
    if (stageWall === "north" || stageWall === "south") {
      // Tables sit behind the dance pad (away from stage).
      if (stageWall === "north") {
        minZ = Math.max(minZ, dance.z + half);
      } else {
        maxZ = Math.min(maxZ, dance.z - half);
      }
    } else if (stageWall === "east") {
      maxX = Math.min(maxX, dance.x - half);
    } else if (stageWall === "west") {
      minX = Math.max(minX, dance.x + half);
    }
  }

  if (maxX - minX < 2) {
    minX = -hx + margin;
    maxX = hx - margin;
  }
  if (maxZ - minZ < 2) {
    minZ = -hz + margin;
    maxZ = hz - margin;
  }

  return { minX, maxX, minZ, maxZ };
}

function placeOnWall(
  room: Room,
  wall: Wall,
  depth: number,
  width: number,
  kind: LayoutItem["kind"],
  along = 0,
): LayoutItem | null {
  if (wall === "none") return null;
  const { hx, hz } = halfExtents(room);
  const n = wallNormal(wall);
  const inset = depth / 2 + 0.05;
  let x = n.x * (hx - inset);
  let z = n.z * (hz - inset);
  if (wall === "north" || wall === "south") x = along;
  else z = along;
  const halfW = width / 2;
  if (wall === "north" || wall === "south") {
    x = Math.max(-hx + halfW, Math.min(hx - halfW, x));
  } else {
    z = Math.max(-hz + halfW, Math.min(hz - halfW, z));
  }
  return item(kind, x, z, wallFacingIn(wall));
}

/** Stage, bar, dance floor, booths, lectern, projector from the spec. */
export function placeFeatures(
  room: Room,
  spec: Spec,
  opts: { skipDance?: boolean } = {},
): LayoutItem[] {
  const items: LayoutItem[] = [];
  const { hx, hz } = halfExtents(room);

  if (spec.stage !== "none") {
    const width = Math.min(
      Math.max(room.widthM, room.lengthM) * STAGE_WIDTH_FRAC,
      (spec.stage === "north" || spec.stage === "south"
        ? room.widthM
        : room.lengthM) - 1,
    );
    const stage = placeOnWall(
      room,
      spec.stage,
      STAGE_DEPTH_M,
      width,
      "stage",
    );
    if (stage) items.push(stage);
  }

  if (spec.bar !== "none") {
    const bar = placeOnWall(room, spec.bar, BAR_DEPTH_M, BAR_WIDTH_M, "bar");
    if (bar) items.push(bar);
  }

  if (!opts.skipDance && spec.extras.includes("dance_floor")) {
    const { x, z } = danceFloorPosition(room, spec);
    items.push(item("dance_floor", x, z, 0));
  }

  if (spec.extras.includes("dj_booth")) {
    const wall: Wall =
      spec.stage !== "none"
        ? spec.stage
        : spec.bar !== "none"
          ? spec.bar
          : "west";
    const booth = placeOnWall(
      room,
      wall,
      BOOTH_SIZE_M,
      BOOTH_SIZE_M,
      "dj_booth",
      wall === "north" || wall === "south" ? -hx * 0.35 : -hz * 0.35,
    );
    if (booth) items.push(booth);
  }

  if (spec.extras.includes("photo_booth")) {
    const booth = placeOnWall(
      room,
      "east",
      BOOTH_SIZE_M,
      BOOTH_SIZE_M,
      "photo_booth",
      hz * 0.25,
    );
    if (booth) items.push(booth);
  }

  if (spec.extras.includes("lectern")) {
    const wall: Wall = spec.stage !== "none" ? spec.stage : "north";
    const lectern = placeOnWall(
      room,
      wall,
      LECTERN_SIZE_M,
      LECTERN_SIZE_M,
      "lectern",
      0,
    );
    if (lectern) {
      const n = wallNormal(wall);
      lectern.x -= n.x * (STAGE_DEPTH_M * 0.15);
      lectern.z -= n.z * (STAGE_DEPTH_M * 0.15);
      items.push(lectern);
    }
  }

  if (spec.extras.includes("projector")) {
    const wall: Wall = spec.stage !== "none" ? spec.stage : "north";
    const screen = placeOnWall(
      room,
      wall,
      0.2,
      PROJECTOR_SIZE_M,
      "projector",
      0,
    );
    if (screen) items.push(screen);
  }

  return items;
}

/** Overflow queue by the south-wall door. */
export function placeOverflow(room: Room, count: number): LayoutItem[] {
  if (count <= 0) return [];
  const { hz } = halfExtents(room);
  const items: LayoutItem[] = [];
  const z = hz - 1.2;
  const cols = Math.min(count, 8);
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * 0.7;
    items.push(item("guest_overflow", x, z - row * 0.7, Math.PI));
  }
  return items;
}

/** Full grid of centres inside bounds with fixed spacing (already centred). */
export function gridCentres(
  bounds: Bounds,
  spacing: number,
  maxCount?: number,
): { x: number; z: number }[] {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  if (width < spacing * 0.5 || depth < spacing * 0.5) return [];

  const cols = Math.max(1, Math.floor(width / spacing));
  const rows = Math.max(1, Math.floor(depth / spacing));
  const usedW = (cols - 1) * spacing;
  const usedD = (rows - 1) * spacing;
  const originX = (bounds.minX + bounds.maxX) / 2 - usedW / 2;
  const originZ = (bounds.minZ + bounds.maxZ) / 2 - usedD / 2;

  const centres: { x: number; z: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      centres.push({ x: originX + c * spacing, z: originZ + r * spacing });
      if (maxCount !== undefined && centres.length >= maxCount) return centres;
    }
  }
  return centres;
}

/**
 * Pack up to `count` centres in bounds, then translate so the used cluster
 * is centred in the free floor area.
 */
export function centredGrid(
  bounds: Bounds,
  spacing: number,
  count: number,
): { x: number; z: number }[] {
  if (count <= 0) return [];
  let centres = gridCentres(bounds, spacing, count);
  if (centres.length === 0) {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    return [{ x: cx, z: cz }];
  }

  const selected = centres.slice(0, count);
  const meanX = selected.reduce((s, p) => s + p.x, 0) / selected.length;
  const meanZ = selected.reduce((s, p) => s + p.z, 0) / selected.length;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;
  const dx = midX - meanX;
  const dz = midZ - meanZ;
  return selected.map((p) => ({ x: p.x + dx, z: p.z + dz }));
}

/** True if a table centre overlaps the dance pad (with clearance). */
export function overlapsDance(
  x: number,
  z: number,
  dance: { x: number; z: number },
  clearance = TABLE_RADIUS_M + 0.4,
): boolean {
  const half = DANCE_SIZE_M / 2 + clearance;
  return (
    Math.abs(x - dance.x) < half && Math.abs(z - dance.z) < half
  );
}
