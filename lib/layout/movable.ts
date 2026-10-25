import type { LayoutItem, LayoutKind, Room } from "../types";
import { TABLE_GROUP_SIZE, footprintBounds, footprintSize } from "./footprint";
import { TABLE_RADIUS_M } from "./shared";

/** Pieces the coordinator / client can drag in Edit layout mode. */
export const MOVABLE_KINDS = [
  "stage",
  "bar",
  "dance_floor",
  "dj_booth",
  "photo_booth",
  "buffet",
  "sign",
  "tv",
  "table_round",
  "high_table",
] as const satisfies readonly LayoutKind[];

export type MovableKind = (typeof MOVABLE_KINDS)[number];

export function isMovableKind(kind: LayoutKind): kind is MovableKind {
  return (MOVABLE_KINDS as readonly string[]).includes(kind);
}

/** Id used for selection / overrides: groupId for tables, else item id. */
export function pickId(item: LayoutItem): string {
  if (item.groupId) return item.groupId;
  return item.id;
}

/** One representative item per movable piece / table group. */
export function movableAnchors(items: LayoutItem[]): LayoutItem[] {
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const it of items) {
    if (!isMovableKind(it.kind)) continue;
    const id = pickId(it);
    if (seen.has(id)) continue;
    // Prefer the table itself over a chair that somehow shares the group.
    if (
      it.groupId &&
      it.kind !== "table_round" &&
      it.kind !== "high_table"
    ) {
      continue;
    }
    seen.add(id);
    out.push(it);
  }
  return out;
}

export function snapHalfMetre(v: number): number {
  return Math.round(v / 0.5) * 0.5;
}

export const PLACEMENT_TOAST: Record<
  "outside" | "taken" | "blocks_exit",
  string
> = {
  outside: "That won't fit inside the room",
  taken: "Something's already there",
  blocks_exit: "Keep the exit and step-free route clear",
};

/** Round pick areas: the whole table group, or just the top ("core"). */
export const TABLE_PICK: Partial<Record<LayoutKind, { full: number; core: number }>> =
  {
    table_round: { full: TABLE_GROUP_SIZE.w / 2, core: TABLE_RADIUS_M },
    high_table: { full: 1.2, core: 0.6 },
  };

/**
 * The movable piece under a floor point, by footprint: tables are discs,
 * everything else its placement rectangle. Where pieces overlap the smallest
 * wins (a DJ booth on the stage, a table at the dance-floor edge), then the
 * nearest centre. `core` shrinks tables to their top so a click on the floor
 * between chairs doesn't count as the table. Pieces in `skip` are ignored.
 */
export function pickAt(
  items: LayoutItem[],
  room: Room,
  x: number,
  z: number,
  { core = false, skip }: { core?: boolean; skip?: string | null } = {},
): string | null {
  let best: { id: string; area: number; dist: number } | null = null;
  for (const a of movableAnchors(items)) {
    const id = pickId(a);
    if (id === skip) continue;
    const dist = Math.hypot(x - a.x, z - a.z);
    const disc = TABLE_PICK[a.kind];
    let area: number;
    if (disc) {
      const r = core ? disc.core : disc.full;
      if (dist > r) continue;
      area = Math.PI * r * r;
    } else {
      const size = footprintSize(a.kind, room, a.rotY);
      const b = footprintBounds(a.x, a.z, size, a.rotY);
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      area = size.w * size.d;
    }
    if (
      !best ||
      area < best.area - 1e-9 ||
      (Math.abs(area - best.area) <= 1e-9 && dist < best.dist)
    ) {
      best = { id, area, dist };
    }
  }
  return best?.id ?? null;
}

/** "Table 3", "Stage", "DJ booth" — shown on hover in Edit layout. */
export function pieceLabel(item: LayoutItem): string {
  const table = /^table-(\d+)$/.exec(pickId(item));
  if (table) return `Table ${table[1]}`;
  const names: Partial<Record<LayoutKind, string>> = {
    stage: "Stage",
    bar: "Bar",
    dance_floor: "Dance floor",
    dj_booth: "DJ booth",
    photo_booth: "Photo booth",
    buffet: "Buffet",
    sign: "Sign",
    tv: "TV screen",
  };
  return names[item.kind] ?? item.kind;
}
