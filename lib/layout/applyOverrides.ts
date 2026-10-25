import type { LayoutItem, LayoutOverride, Room } from "../types";
import { footprintBounds, footprintSize } from "./footprint";
import { item, type Bounds } from "./shared";

function rotateAround(
  x: number,
  z: number,
  cx: number,
  cz: number,
  dRot: number,
): { x: number; z: number } {
  const dx = x - cx;
  const dz = z - cz;
  const cos = Math.cos(dRot);
  const sin = Math.sin(dRot);
  // Yaw about +y: local (+x,+z) → (x cos + z sin, −x sin + z cos) in xz.
  return {
    x: cx + dx * cos + dz * sin,
    z: cz - dx * sin + dz * cos,
  };
}

function tableCentre(group: LayoutItem[]): { x: number; z: number; rotY: number } {
  const table =
    group.find((i) => i.kind === "table_round" || i.kind === "high_table") ??
    group[0]!;
  return { x: table.x, z: table.z, rotY: table.rotY };
}

/** Stage dressing that travels with the stage when it moves. */
const STAGE_DRESSING = new Set<LayoutItem["kind"]>(["lectern", "projector"]);

/**
 * Pieces an override keyed `key` acts on: its table group, a stage and its
 * dressing, or the single item with that id.
 */
function piecesFor(items: LayoutItem[], key: string): LayoutItem[] {
  const group = items.filter((it) => it.groupId === key);
  if (group.length > 0) return group;
  const it = items.find((i) => i.id === key);
  if (!it) return [];
  if (it.kind !== "stage") return [it];
  return [it, ...items.filter((i) => STAGE_DRESSING.has(i.kind))];
}

/** People who stand anywhere — they step aside when furniture lands on them. */
const LOOSE_PEOPLE = new Set<LayoutItem["kind"]>([
  "guest_standing",
  "guest_overflow",
]);
const NOT_FURNITURE = new Set<LayoutItem["kind"]>([
  "chair",
  "guest_seated",
  "guest_standing",
  "guest_overflow",
  "projector",
]);
/** Half-size of the square a table and its chairs cover. */
const TABLE_HALF_M = 1.5;

function furnitureRect(it: LayoutItem, room: Room): Bounds {
  if (it.kind === "table_round" || it.kind === "high_table") {
    const h = it.kind === "table_round" ? TABLE_HALF_M : 0.6;
    return { minX: it.x - h, maxX: it.x + h, minZ: it.z - h, maxZ: it.z + h };
  }
  return footprintBounds(
    it.x,
    it.z,
    footprintSize(it.kind, room, it.rotY),
    it.rotY,
  );
}

function inside(x: number, z: number, r: Bounds): boolean {
  return x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
}

/**
 * Standing and queuing guests inside a moved or added piece walk to the
 * nearest free floor (0.5 m rings out to 6 m); if there's none they stay put.
 */
function clearPeople(
  items: LayoutItem[],
  movedIds: Set<string>,
  room: Room,
): LayoutItem[] {
  const furniture = items.filter((it) => !NOT_FURNITURE.has(it.kind));
  const moved = furniture
    .filter((it) => movedIds.has(it.id))
    .map((it) => furnitureRect(it, room));
  if (moved.length === 0) return items;
  const all = furniture.map((it) => furnitureRect(it, room));
  const hx = room.widthM / 2 - 0.3;
  const hz = room.lengthM / 2 - 0.3;
  const free = (x: number, z: number) =>
    Math.abs(x) < hx && Math.abs(z) < hz && !all.some((r) => inside(x, z, r));

  return items.map((it) => {
    if (!LOOSE_PEOPLE.has(it.kind)) return it;
    if (!moved.some((r) => inside(it.x, it.z, r))) return it;
    for (let ring = 1; ring <= 12; ring++) {
      const d = ring * 0.5;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = it.x + Math.cos(a) * d;
        const z = it.z + Math.sin(a) * d;
        if (free(x, z)) return { ...it, x, z };
      }
    }
    return it;
  });
}

/**
 * Apply manual furniture edits. Empty / missing overrides leave items unchanged.
 * An override keyed by groupId (or the table's id) translates and rotates the
 * whole table group around the table centre; a stage override carries the
 * lectern and projector with it. `removed` deletes the piece (a table with its
 * chairs and guests); an override with a `kind` and a fresh key adds that
 * piece. With the room, standing guests step out of anything moved onto them.
 */
export function applyOverrides(
  items: LayoutItem[],
  overrides?: Record<string, LayoutOverride> | null,
  room?: Room,
): LayoutItem[] {
  if (!overrides) return items;
  const keys = Object.keys(overrides);
  if (keys.length === 0) return items;

  let next = items.map((it) => ({ ...it }));
  const movedIds = new Set<string>();

  for (const key of keys) {
    const override = overrides[key]!;
    const group = piecesFor(next, key);

    if (override.removed) {
      const ids = new Set(group.map((g) => g.id));
      next = next.filter((it) => !ids.has(it.id));
      continue;
    }

    if (group.length === 0) {
      if (override.kind) {
        next.push(item(override.kind, override.x, override.z, override.rotY, key));
        movedIds.add(key);
      }
      continue;
    }

    const centre = tableCentre(group);
    const dRot = override.rotY - centre.rotY;
    const ids = new Set(group.map((g) => g.id));
    for (const id of ids) movedIds.add(id);
    next = next.map((it) => {
      if (!ids.has(it.id)) return it;
      const rotated = rotateAround(it.x, it.z, centre.x, centre.z, dRot);
      return {
        ...it,
        x: rotated.x + (override.x - centre.x),
        z: rotated.z + (override.z - centre.z),
        rotY: it.rotY + dRot,
      };
    });
  }

  return room ? clearPeople(next, movedIds, room) : next;
}
