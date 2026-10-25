import type { LayoutItem, LayoutKind } from "../types";

/** Pieces the coordinator / client can drag in Edit layout mode. */
export const MOVABLE_KINDS = [
  "stage",
  "bar",
  "dance_floor",
  "dj_booth",
  "photo_booth",
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
