import type { LayoutItem, Room, Spec, Wall } from "../types";

/** Origin at room centre. +x = east, −z = north, +z = south. */

export const TABLE_DIAMETER_M = 1.8;
export const TABLE_RADIUS_M = TABLE_DIAMETER_M / 2;
export const TABLE_SPACING_M = 3;
/** Tightest table centres before we drop a table. */
export const TABLE_SPACING_MIN_M = 2.6;
/** Widest we spread tables when the room has space to spare. */
export const TABLE_SPACING_MAX_M = 4.4;
export const CHAIRS_PER_ROUND = 10;
export const CHAIR_RADIUS_M = TABLE_RADIUS_M + 0.55;
export const AISLE_ACCESSIBLE_M = 1.5;
/** Step-free route strip width (matches accessible aisle). */
export const ACCESS_ROUTE_M = AISLE_ACCESSIBLE_M;
export const AISLE_DEFAULT_M = 0.8;
export const THEATRE_AISLE_M = 1.2;
export const STAGE_DEPTH_M = 2.4;
export const STAGE_WIDTH_FRAC = 0.55;
export const BAR_DEPTH_M = 1.2;
export const BAR_WIDTH_M = 3.5;
export const DANCE_SIZE_M = 6;
export const BOOTH_SIZE_M = 1.6;
export const BUFFET_WIDTH_M = 4.8;
export const BUFFET_DEPTH_M = 0.9;
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

/**
 * Yaw so +z local faces into the room from that wall. three.js yaw θ turns
 * local +z to world (sin θ, cos θ), so the east wall (+x) faces in at −π/2.
 */
export function wallFacingIn(wall: Wall): number {
  switch (wall) {
    case "north":
      return 0;
    case "south":
      return Math.PI;
    case "east":
      return -Math.PI / 2;
    case "west":
      return Math.PI / 2;
    default:
      return 0;
  }
}

/** Yaw so +z local (chair / guest front) faces that wall, e.g. seats facing the stage. */
export function wallFacingOut(wall: Wall): number {
  const n = wallNormal(wall);
  return Math.atan2(n.x, n.z);
}

export function item(
  kind: LayoutItem["kind"],
  x: number,
  z: number,
  rotY = 0,
  id: string = kind,
  groupId?: string,
): LayoutItem {
  return groupId !== undefined
    ? { id, kind, x, z, rotY, groupId }
    : { id, kind, x, z, rotY };
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

/**
 * Dance floor directly in front of the stage (stage depth + half an aisle in
 * from that wall, centred along it). With no stage it sits in the room centre.
 */
export function danceFloorPosition(
  room: Room,
  spec: Spec,
): { x: number; z: number } {
  const { hx, hz } = halfExtents(room);
  const half = DANCE_SIZE_M / 2;
  if (spec.stage === "none") return { x: 0, z: 0 };
  const n = wallNormal(spec.stage);
  const margin = aisleMargin(spec.accessible);
  const inset = STAGE_DEPTH_M + margin * 0.5 + half;
  // Start on the stage wall and step into the room by `inset`.
  let x = n.x * (hx - inset);
  let z = n.z * (hz - inset);
  x = Math.max(-hx + half + 0.2, Math.min(hx - half - 0.2, x));
  z = Math.max(-hz + half + 0.2, Math.min(hz - half - 0.2, z));
  return { x, z };
}

/**
 * Buffet runs along a side wall the stage and bar aren't using (west first),
 * offset along the wall so it clears the south door / east photo booth.
 */
export function buffetPlacement(
  room: Room,
  spec: Spec,
): { wall: Wall; along: number } {
  const { hx, hz } = halfExtents(room);
  const used = new Set<Wall>([spec.stage, spec.bar]);
  const order: Wall[] = ["west", "east", "south", "north"];
  const wall = order.find((w) => !used.has(w)) ?? "west";
  let along = 0;
  if (wall === "east" && spec.extras.includes("photo_booth")) along = -hz * 0.3;
  if (wall === "south") along = -hx * 0.3; // keep the door clear
  return { wall, along };
}

/**
 * 1.5 m step-free route hugging the walls (so the seating grid stays open):
 * south door → side wall → stage front, plus a wall-run to the bar and a short
 * spur into one table cluster. Empty when accessible is off.
 */
export function accessibleRouteRects(room: Room, spec: Spec): Bounds[] {
  if (!spec.accessible) return [];
  const { hx, hz } = halfExtents(room);
  const half = ACCESS_ROUTE_M / 2;
  const margin = aisleMargin(true);
  const rects: Bounds[] = [];

  // Side lane on the wall that isn't carrying the bar (west by default).
  const alongWest = spec.bar !== "west";
  const laneX = alongWest ? -hx + margin + half : hx - margin - half;
  const southZ = hz - margin - half;
  let northZ = -hz + margin + half;
  if (spec.stage === "north") northZ = -hz + STAGE_DEPTH_M + half + 0.15;

  const hStrip = (x0: number, x1: number, z: number) => {
    rects.push({
      minX: Math.min(x0, x1) - half,
      maxX: Math.max(x0, x1) + half,
      minZ: z - half,
      maxZ: z + half,
    });
  };
  const vStrip = (x: number, z0: number, z1: number) => {
    rects.push({
      minX: x - half,
      maxX: x + half,
      minZ: Math.min(z0, z1) - half,
      maxZ: Math.max(z0, z1) + half,
    });
  };

  // Door pad.
  hStrip(-0.1, 0.1, southZ);
  // Along the south wall to the side lane.
  hStrip(0, laneX, southZ);
  // Side lane up to the stage / north apron.
  vStrip(laneX, southZ, northZ);
  // Across to the stage centre.
  hStrip(laneX, 0, northZ);

  // Wall-run to the bar (never cuts through the seating floor).
  if (spec.bar === "east" || spec.bar === "west") {
    const barX = spec.bar === "east" ? hx - margin - half : -hx + margin + half;
    const bar = wallFootprint(room, spec.bar, BAR_DEPTH_M, BAR_WIDTH_M);
    const barCz = (bar.minZ + bar.maxZ) / 2;
    // South wall to the bar's wall, then up/down to the bar.
    hStrip(0, barX, southZ);
    vStrip(barX, southZ, barCz);
  } else if (spec.bar === "north" || spec.bar === "south") {
    const bar = wallFootprint(room, spec.bar, BAR_DEPTH_M, BAR_WIDTH_M);
    const barCx = (bar.minX + bar.maxX) / 2;
    const barZ =
      spec.bar === "north" ? -hz + margin + half : hz - margin - half;
    hStrip(laneX, barCx, barZ === southZ ? southZ : northZ);
    if (spec.bar === "north") vStrip(barCx, northZ, barZ);
  }

  // Short spur into one table cluster from the side lane.
  {
    const spurZ = Math.max(northZ + 2, Math.min(southZ - 2.5, 1.2));
    const endX = alongWest ? laneX + 2.6 : laneX - 2.6;
    hStrip(laneX, endX, spurZ);
  }

  return rects;
}

/**
 * Blocked rectangles: dance floor, stage, bar, booths, buffet, accessible route.
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

  if (spec.extras.includes("buffet")) {
    const { wall, along } = buffetPlacement(room, spec);
    // Extra depth so guests can queue along the serving side.
    rects.push(
      wallFootprint(room, wall, BUFFET_DEPTH_M + 1.0, BUFFET_WIDTH_M, along),
    );
  }

  // Only the short inward spur needs to block packing — the wall-hugging
  // lane already sits inside the accessible aisle margin.
  rects.push(...accessibleRouteBlocks(room, spec));

  return rects;
}

/** Packing-only subset of the accessible route (the spur into seating). */
export function accessibleRouteBlocks(room: Room, spec: Spec): Bounds[] {
  if (!spec.accessible) return [];
  const { hx, hz } = halfExtents(room);
  const half = ACCESS_ROUTE_M / 2;
  const margin = aisleMargin(true);
  const alongWest = spec.bar !== "west";
  const laneX = alongWest ? -hx + margin + half : hx - margin - half;
  const southZ = hz - margin - half;
  let northZ = -hz + margin + half;
  if (spec.stage === "north") northZ = -hz + STAGE_DEPTH_M + half + 0.15;
  const spurZ = Math.max(northZ + 2, Math.min(southZ - 2.5, 1.2));
  const endX = alongWest ? laneX + 2.6 : laneX - 2.6;
  return [
    {
      minX: Math.min(laneX, endX),
      maxX: Math.max(laneX, endX),
      minZ: spurZ - half,
      maxZ: spurZ + half,
    },
  ];
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

  if (spec.extras.includes("buffet")) {
    const { wall, along } = buffetPlacement(room, spec);
    const buffet = placeOnWall(
      room,
      wall,
      BUFFET_DEPTH_M,
      BUFFET_WIDTH_M,
      "buffet",
      along,
    );
    if (buffet) items.push(buffet);
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
      placed += 1;
      items.push(
        item("guest_overflow", x, z, Math.PI, `guest_overflow-${placed}`),
      );
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
    placed += 1;
    items.push(
      item("guest_overflow", x, z, Math.PI, `guest_overflow-${placed}`),
    );
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
 * Place `tablesNeeded` round-table centres. Spacing adapts to the room: start
 * wide (4.4 m) and tighten until the free grid just fits the count, so tables
 * spread across the usable floor instead of clustering in the middle; then
 * step down to 2.6 m and finally a denser greedy fill. Never drops below
 * tablesNeeded if any free cell exists. Avoids blocked feature rectangles.
 */
export function packRoundTables(
  room: Room,
  spec: Spec,
  tablesNeeded: number,
  clearance = TABLE_RADIUS_M + 0.25,
): Point[] {
  if (tablesNeeded <= 0) return [];
  // Table centres must leave room for the chairs plus the wall aisle.
  const inset = CHAIR_RADIUS_M + 0.2;
  const sb = seatingBounds(room, spec);
  const bounds: Bounds = {
    minX: sb.minX + inset,
    maxX: sb.maxX - inset,
    minZ: sb.minZ + inset,
    maxZ: sb.maxZ - inset,
  };
  const blocks = blockedRects(room, spec);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;

  const freeAt = (spacing: number): Point[] =>
    gridCentres(bounds, spacing).filter(
      (p) => !isBlocked(p.x, p.z, clearance, blocks),
    );

  // Rows run parallel to the stage wall (or east-west with no stage) and are
  // filled from the stage outwards; the last partial row is centred.
  const stage: Wall = spec.stage;
  const rowsAlongX = stage !== "east" && stage !== "west";
  const rowKey = (p: Point) => (rowsAlongX ? p.z : p.x);
  const alongKey = (p: Point) => (rowsAlongX ? p.x : p.z);
  const rowOrder = (k: number): number => {
    switch (stage) {
      case "north":
        return k; // nearest the north wall (most negative z) first
      case "south":
        return -k;
      case "west":
        return k;
      case "east":
        return -k;
      default:
        return Math.abs(k - (rowsAlongX ? midZ : midX)); // middle rows first
    }
  };

  const pickBalanced = (free: Point[], n: number): Point[] => {
    const rows = new Map<number, Point[]>();
    for (const p of free) {
      const k = Math.round(rowKey(p) * 100) / 100;
      const row = rows.get(k);
      if (row) row.push(p);
      else rows.set(k, [p]);
    }
    const ordered = [...rows.entries()].sort(
      (a, b) => rowOrder(a[0]) - rowOrder(b[0]),
    );
    // Stub rows (a cell or two wedged beside the stage) go last.
    const fullest = Math.max(...ordered.map(([, r]) => r.length));
    ordered.sort((a, b) => {
      const stubA = a[1].length <= Math.max(1, fullest / 3) ? 1 : 0;
      const stubB = b[1].length <= Math.max(1, fullest / 3) ? 1 : 0;
      return stubA - stubB;
    });
    const out: Point[] = [];
    for (const [, row] of ordered) {
      const remaining = n - out.length;
      if (remaining <= 0) break;
      if (row.length <= remaining) {
        out.push(...row);
        continue;
      }
      // Partial row: keep the cells nearest the row's own centre.
      const centre = row.reduce((s, p) => s + alongKey(p), 0) / row.length;
      const nearest = [...row].sort(
        (a, b) =>
          Math.abs(alongKey(a) - centre) - Math.abs(alongKey(b) - centre),
      );
      out.push(...nearest.slice(0, remaining));
    }
    return out;
  };

  for (
    let spacing = TABLE_SPACING_MAX_M;
    spacing >= TABLE_SPACING_MIN_M - 0.001;
    spacing -= 0.1
  ) {
    const free = freeAt(spacing);
    if (free.length >= tablesNeeded) {
      return pickBalanced(free, tablesNeeded);
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

/**
 * Banquet packing: even grid across the free floor (room − blocked), centred
 * on both axes. Widens spacing to fill the room when capacity allows.
 */
export function packBanquetTables(
  room: Room,
  spec: Spec,
  tablesNeeded: number,
  clearance = TABLE_RADIUS_M + 0.25,
): Point[] {
  if (tablesNeeded <= 0) return [];
  const inset = CHAIR_RADIUS_M + 0.2;
  const sb = seatingBounds(room, spec);
  const bounds: Bounds = {
    minX: sb.minX + inset,
    maxX: sb.maxX - inset,
    minZ: sb.minZ + inset,
    maxZ: sb.maxZ - inset,
  };
  const blocks = blockedRects(room, spec);
  const freeAt = (spacing: number): Point[] =>
    gridCentres(bounds, spacing).filter(
      (p) => !isBlocked(p.x, p.z, clearance, blocks),
    );

  const pickCentredEven = (free: Point[], n: number): Point[] => {
    if (free.length <= n) return free.slice(0, n);
    // Group into rows (constant z).
    const rows = new Map<number, Point[]>();
    for (const p of free) {
      const k = Math.round(p.z * 100) / 100;
      const row = rows.get(k);
      if (row) row.push(p);
      else rows.set(k, [p]);
    }
    const ordered = [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x));
    if (ordered.length === 0) return free.slice(0, n);

    const avgCols =
      ordered.reduce((s, r) => s + r.length, 0) / ordered.length;
    // Prefer enough rows to cover depth, but not more than we can fill.
    let numRows = Math.min(
      ordered.length,
      Math.max(1, Math.round(n / Math.max(1, avgCols))),
    );
    // Grow rows if a single row would be overstuffed.
    while (
      numRows < ordered.length &&
      Math.ceil(n / numRows) > Math.max(...ordered.map((r) => r.length))
    ) {
      numRows += 1;
    }
    const start = Math.max(0, Math.floor((ordered.length - numRows) / 2));
    const chosenRows = ordered.slice(start, start + numRows);

    // Spread n across chosen rows as evenly as possible.
    const base = Math.floor(n / chosenRows.length);
    let extra = n % chosenRows.length;
    const out: Point[] = [];
    for (const row of chosenRows) {
      const take = Math.min(row.length, base + (extra > 0 ? 1 : 0));
      if (extra > 0) extra -= 1;
      if (take <= 0) continue;
      if (take >= row.length) {
        out.push(...row);
        continue;
      }
      // Centred subset of this row.
      const origin = Math.floor((row.length - take) / 2);
      out.push(...row.slice(origin, origin + take));
    }
    // Top up from leftover free cells if a stub row ran short.
    if (out.length < n) {
      const used = new Set(out.map((p) => `${p.x},${p.z}`));
      for (const p of free) {
        if (out.length >= n) break;
        const key = `${p.x},${p.z}`;
        if (used.has(key)) continue;
        out.push(p);
        used.add(key);
      }
    }
    return out.slice(0, n);
  };

  for (
    let spacing = TABLE_SPACING_MAX_M;
    spacing >= TABLE_SPACING_MIN_M - 0.001;
    spacing -= 0.1
  ) {
    const free = freeAt(spacing);
    if (free.length >= tablesNeeded) {
      return pickCentredEven(free, tablesNeeded);
    }
  }

  // Fall back to the denser stage-aware packer.
  return packRoundTables(room, spec, tablesNeeded, clearance);
}
