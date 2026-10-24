import type { LayoutItem, Room, Spec, Wall } from "../types";

/** Origin at room centre. +x = east, −z = north, +z = south. */

export const TABLE_DIAMETER_M = 1.8;
export const TABLE_RADIUS_M = TABLE_DIAMETER_M / 2;
export const TABLE_SPACING_M = 3;
/** Tightest table centres before we drop a table. */
export const TABLE_SPACING_MIN_M = 2.6;
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

export type Point = { x: number; z: number };

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

export function stageWidth(room: Room, wall: Wall): number {
  const along =
    wall === "north" || wall === "south" ? room.widthM : room.lengthM;
  return Math.min(
    Math.max(room.widthM, room.lengthM) * STAGE_WIDTH_FRAC,
    along - 1,
  );
}

/** Axis-aligned footprint of a wall-mounted feature. */
export function wallFootprint(
  room: Room,
  wall: Wall,
  depth: number,
  width: number,
  along = 0,
): Bounds {
  const { hx, hz } = halfExtents(room);
  const n = wallNormal(wall);
  const inset = depth / 2 + 0.05;
  let x = n.x * (hx - inset);
  let z = n.z * (hz - inset);
  if (wall === "north" || wall === "south") x = along;
  else z = along;
  const halfW = width / 2;
  const halfD = depth / 2;
  if (wall === "north" || wall === "south") {
    x = Math.max(-hx + halfW, Math.min(hx - halfW, x));
    return {
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z + halfD,
    };
  }
  z = Math.max(-hz + halfW, Math.min(hz - halfW, z));
  return {
    minX: x - halfD,
    maxX: x + halfD,
    minZ: z - halfW,
    maxZ: z + halfW,
  };
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
  const half = DANCE_SIZE_M / 2;
  x = Math.max(-hx + half + 0.2, Math.min(hx - half - 0.2, x));
  z = Math.max(-hz + half + 0.2, Math.min(hz - half - 0.2, z));
  return { x, z };
}

/**
 * Blocked rectangles: dance floor, stage, bar, booths.
 * All table/guest placement must stay clear of these.
 */
export function blockedRects(room: Room, spec: Spec): Bounds[] {
  const rects: Bounds[] = [];
  const { hx, hz } = halfExtents(room);

  if (spec.stage !== "none") {
    rects.push(
      wallFootprint(
        room,
        spec.stage,
        STAGE_DEPTH_M,
        stageWidth(room, spec.stage),
      ),
    );
  }

  if (spec.bar !== "none") {
    rects.push(wallFootprint(room, spec.bar, BAR_DEPTH_M, BAR_WIDTH_M));
  }

  if (spec.extras.includes("dance_floor")) {
    const { x, z } = danceFloorPosition(room, spec);
    const h = DANCE_SIZE_M / 2;
    rects.push({ minX: x - h, maxX: x + h, minZ: z - h, maxZ: z + h });
  }

  if (spec.extras.includes("dj_booth")) {
    const wall: Wall =
      spec.stage !== "none"
        ? spec.stage
        : spec.bar !== "none"
          ? spec.bar
          : "west";
    const along =
      wall === "north" || wall === "south" ? -hx * 0.35 : -hz * 0.35;
    rects.push(wallFootprint(room, wall, BOOTH_SIZE_M, BOOTH_SIZE_M, along));
  }

  if (spec.extras.includes("photo_booth")) {
    rects.push(
      wallFootprint(room, "east", BOOTH_SIZE_M, BOOTH_SIZE_M, hz * 0.25),
    );
  }

  return rects;
}

/** True if a disc of radius `clearance` overlaps any blocked rect. */
export function isBlocked(
  x: number,
  z: number,
  clearance: number,
  blocks: Bounds[],
): boolean {
  for (const r of blocks) {
    if (
      x + clearance > r.minX &&
      x - clearance < r.maxX &&
      z + clearance > r.minZ &&
      z - clearance < r.maxZ
    ) {
      return true;
    }
  }
  return false;
}

/** Usable floor after wall clearance (features handled via blockedRects). */
export function seatingBounds(
  room: Room,
  spec: Spec,
  _opts: { reserveDance?: boolean } = {},
): Bounds {
  const { hx, hz } = halfExtents(room);
  const margin = aisleMargin(spec.accessible);
  return {
    minX: -hx + margin,
    maxX: hx - margin,
    minZ: -hz + margin,
    maxZ: hz - margin,
  };
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
    const stage = placeOnWall(
      room,
      spec.stage,
      STAGE_DEPTH_M,
      stageWidth(room, spec.stage),
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

/**
 * Overflow queue just inside the SOUTH door.
 * Never on dance floor, stage or bar (or booth) footprints.
 */
export function placeOverflow(
  room: Room,
  count: number,
  blocks: Bounds[] = [],
): LayoutItem[] {
  if (count <= 0) return [];
  const { hx, hz } = halfExtents(room);
  const items: LayoutItem[] = [];
  const spacing = 0.65;
  const clearance = 0.35;
  let placed = 0;
  let row = 0;

  while (placed < count && row < 24) {
    const z = hz - 1.35 - row * spacing;
    if (z < -hz + 1) break;
    const maxCols = Math.max(
      1,
      Math.floor((Math.min(hx, 6) * 2 - 1.2) / spacing),
    );
    const cols = Math.min(count - placed, maxCols);
    for (let c = 0; c < cols && placed < count; c++) {
      const x = (c - (cols - 1) / 2) * spacing;
      if (isBlocked(x, z, clearance, blocks)) continue;
      items.push(item("guest_overflow", x, z, Math.PI));
      placed += 1;
    }
    row += 1;
  }

  // Last-resort fill: walk north from the door, skipping blocked cells.
  let guard = 0;
  while (placed < count && guard < 400) {
    const col = guard % 10;
    const r = Math.floor(guard / 10);
    const x = (col - 4.5) * spacing;
    const z = hz - 1.35 - r * spacing;
    guard += 1;
    if (Math.abs(x) > hx - 0.5 || z < -hz + 0.5) continue;
    if (isBlocked(x, z, clearance, blocks)) continue;
    items.push(item("guest_overflow", x, z, Math.PI));
    placed += 1;
  }

  return items;
}

/** Full grid of centres inside bounds with fixed spacing (already centred). */
export function gridCentres(
  bounds: Bounds,
  spacing: number,
  maxCount?: number,
): Point[] {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  if (width < spacing * 0.5 || depth < spacing * 0.5) return [];

  const cols = Math.max(1, Math.floor(width / spacing) + 1);
  const rows = Math.max(1, Math.floor(depth / spacing) + 1);
  const usedW = (cols - 1) * spacing;
  const usedD = (rows - 1) * spacing;
  const originX = (bounds.minX + bounds.maxX) / 2 - usedW / 2;
  const originZ = (bounds.minZ + bounds.maxZ) / 2 - usedD / 2;

  const centres: Point[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * spacing;
      const z = originZ + r * spacing;
      if (
        x < bounds.minX - 0.01 ||
        x > bounds.maxX + 0.01 ||
        z < bounds.minZ - 0.01 ||
        z > bounds.maxZ + 0.01
      ) {
        continue;
      }
      centres.push({ x, z });
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
): Point[] {
  if (count <= 0) return [];
  const centres = gridCentres(bounds, spacing, count);
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
  return Math.abs(x - dance.x) < half && Math.abs(z - dance.z) < half;
}

/**
 * Place `tablesNeeded` round-table centres: try 3.0 m spacing, step down to
 * 2.6 m, then denser greedy fill. Never drops below tablesNeeded if any free
 * cell exists. Avoids blocked feature rectangles.
 */
export function packRoundTables(
  room: Room,
  spec: Spec,
  tablesNeeded: number,
  clearance = TABLE_RADIUS_M + 0.25,
): Point[] {
  if (tablesNeeded <= 0) return [];
  const bounds = seatingBounds(room, spec);
  const blocks = blockedRects(room, spec);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;

  const freeAt = (spacing: number): Point[] =>
    gridCentres(bounds, spacing).filter(
      (p) => !isBlocked(p.x, p.z, clearance, blocks),
    );

  const pickClosest = (free: Point[], n: number): Point[] => {
    const sorted = [...free].sort((a, b) => {
      const da = (a.x - midX) ** 2 + (a.z - midZ) ** 2;
      const db = (b.x - midX) ** 2 + (b.z - midZ) ** 2;
      return da - db;
    });
    const pick = sorted.slice(0, n);
    if (pick.length === 0) return pick;
    const meanX = pick.reduce((s, p) => s + p.x, 0) / pick.length;
    const meanZ = pick.reduce((s, p) => s + p.z, 0) / pick.length;
    const dx = midX - meanX;
    const dz = midZ - meanZ;
    const shifted = pick.map((p) => ({ x: p.x + dx, z: p.z + dz }));
    if (shifted.every((p) => !isBlocked(p.x, p.z, clearance, blocks))) {
      return shifted;
    }
    return pick;
  };

  for (
    let spacing = TABLE_SPACING_M;
    spacing >= TABLE_SPACING_MIN_M - 0.001;
    spacing -= 0.1
  ) {
    const free = freeAt(spacing);
    if (free.length >= tablesNeeded) {
      return pickClosest(free, tablesNeeded);
    }
  }

  // Still short at 2.6 m — denser candidate grid, greedy non-overlap.
  const dense = freeAt(TABLE_SPACING_MIN_M * 0.85);
  const placed: Point[] = [];
  const sorted = [...dense].sort((a, b) => {
    const da = (a.x - midX) ** 2 + (a.z - midZ) ** 2;
    const db = (b.x - midX) ** 2 + (b.z - midZ) ** 2;
    return da - db;
  });
  for (const p of sorted) {
    if (placed.length >= tablesNeeded) break;
    if (
      placed.some(
        (q) => Math.hypot(q.x - p.x, q.z - p.z) < TABLE_SPACING_MIN_M - 0.05,
      )
    ) {
      continue;
    }
    placed.push(p);
  }

  // Force remaining at free spots even if slightly tight.
  if (placed.length < tablesNeeded) {
    for (const p of sorted) {
      if (placed.length >= tablesNeeded) break;
      if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.2)) continue;
      placed.push(p);
    }
  }

  return placed.slice(0, tablesNeeded);
}
