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
export const DANCE_SIZE_M = 4;
export const BOOTH_SIZE_M = 1.6;
export const LECTERN_SIZE_M = 0.7;
export const PROJECTOR_SIZE_M = 2.2;
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
      return 0; // face +z (southward)
    case "south":
      return Math.PI;
    case "east":
      return Math.PI / 2; // face −x
    case "west":
      return -Math.PI / 2; // face +x
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

/** Usable floor after wall clearance and reserved strips (stage / bar / dance). */
export function seatingBounds(
  room: Room,
  spec: Spec,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
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
  if (spec.extras.includes("dance_floor")) {
    // Dance floor sits mid-room toward the stage; shrink the far side lightly.
    const stageWall = spec.stage === "none" ? "north" : spec.stage;
    const opposite: Wall =
      stageWall === "north"
        ? "south"
        : stageWall === "south"
          ? "north"
          : stageWall === "east"
            ? "west"
            : "east";
    reserve(opposite, DANCE_SIZE_M * 0.35);
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
  // Clamp so wide pieces stay inside the wall span.
  const halfW = width / 2;
  if (wall === "north" || wall === "south") {
    x = Math.max(-hx + halfW, Math.min(hx - halfW, x));
  } else {
    z = Math.max(-hz + halfW, Math.min(hz - halfW, z));
  }
  return item(kind, x, z, wallFacingIn(wall));
}

/** Stage, bar, dance floor, booths, lectern, projector from the spec. */
export function placeFeatures(room: Room, spec: Spec): LayoutItem[] {
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

  if (spec.extras.includes("dance_floor")) {
    const stageWall = spec.stage === "none" ? "north" : spec.stage;
    const n = wallNormal(stageWall);
    // Centre-ish, slightly toward the opposite wall from the stage.
    const x = -n.x * Math.min(2, hx * 0.15);
    const z = -n.z * Math.min(2, hz * 0.15);
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
      // Nudge slightly into the room in front of the stage lip.
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
export function placeOverflow(
  room: Room,
  count: number,
): LayoutItem[] {
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

/** Grid of centres inside bounds with fixed spacing. */
export function gridCentres(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
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
