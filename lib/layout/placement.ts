import type { LayoutItem, LayoutOverride, Room, Spec, Wall } from "../types";
import {
  TABLE_GROUP_SIZE,
  footprintBounds,
  footprintSize,
  rectInside,
  rectsOverlap,
  type FootprintSize,
} from "./footprint";
import {
  ACCESS_ROUTE_M,
  accessibleRouteRects,
  halfExtents,
  type Bounds,
} from "./shared";

export type PlacementIssue = "outside" | "taken" | "blocks_exit";

function inferWall(item: LayoutItem, room: Room): Wall {
  const { hx, hz } = halfExtents(room);
  const edgeX = hx * 0.55;
  const edgeZ = hz * 0.55;
  if (item.z <= -edgeZ) return "north";
  if (item.z >= edgeZ) return "south";
  if (item.x >= edgeX) return "east";
  if (item.x <= -edgeX) return "west";
  return "none";
}

/** Rebuild a minimal spec so accessibleRouteRects can run from placed items. */
function routeSpec(items: LayoutItem[], room: Room, accessible: boolean): Spec {
  const stage = items.find((i) => i.kind === "stage");
  const bar = items.find((i) => i.kind === "bar");
  return {
    style: "banquet",
    guests: 1,
    stage: stage ? inferWall(stage, room) : "none",
    bar: bar ? inferWall(bar, room) : "none",
    extras: [],
    accessible,
  };
}

/** 1.5 m clear pad just inside the south door. */
function southDoorClear(room: Room): Bounds {
  const { hz } = halfExtents(room);
  const half = ACCESS_ROUTE_M / 2;
  return {
    minX: -half,
    maxX: half,
    minZ: hz - ACCESS_ROUTE_M,
    maxZ: hz,
  };
}

function resolveTarget(
  id: string,
  items: LayoutItem[],
): {
  exclude: Set<string>;
  size: FootprintSize;
} | null {
  const group = items.filter((it) => it.groupId === id);
  if (group.length > 0) {
    return {
      exclude: new Set(group.map((g) => g.id)),
      size: TABLE_GROUP_SIZE,
    };
  }
  const it = items.find((i) => i.id === id);
  if (!it) return null;
  return {
    exclude: new Set([it.id]),
    size: footprintSize(it.kind),
  };
}

/** Occupied footprints, one rect per table group and per ungrouped piece. */
function occupiedBounds(
  items: LayoutItem[],
  exclude: Set<string>,
): Bounds[] {
  const seenGroups = new Set<string>();
  const rects: Bounds[] = [];

  for (const it of items) {
    if (exclude.has(it.id)) continue;
    if (it.groupId) {
      if (exclude.has(it.groupId)) continue;
      if (seenGroups.has(it.groupId)) continue;
      seenGroups.add(it.groupId);
      const group = items.filter((g) => g.groupId === it.groupId);
      const table =
        group.find((g) => g.kind === "table_round" || g.kind === "high_table") ??
        group[0]!;
      rects.push(
        footprintBounds(table.x, table.z, TABLE_GROUP_SIZE, table.rotY),
      );
      continue;
    }
    // Guests never block furniture moves (and are hidden in edit mode).
    // Chairs without a groupId are covered by their table footprint.
    if (
      it.kind === "chair" ||
      it.kind === "guest_seated" ||
      it.kind === "guest_standing" ||
      it.kind === "guest_overflow"
    ) {
      continue;
    }
    rects.push(footprintBounds(it.x, it.z, footprintSize(it.kind), it.rotY));
  }
  return rects;
}

/**
 * Whether placing `id` at `candidate` is legal.
 * Returns null when ok, otherwise the first problem found.
 * When `accessible` is true, also keeps the step-free wall route clear.
 */
export function placementProblem(
  id: string,
  candidate: LayoutOverride,
  items: LayoutItem[],
  room: Room,
  accessible = false,
): PlacementIssue | null {
  const target = resolveTarget(id, items);
  if (!target) return "taken";

  const candidateRect = footprintBounds(
    candidate.x,
    candidate.z,
    target.size,
    candidate.rotY,
  );

  const { hx, hz } = halfExtents(room);
  const roomRect: Bounds = {
    minX: -hx,
    maxX: hx,
    minZ: -hz,
    maxZ: hz,
  };
  if (!rectInside(candidateRect, roomRect)) return "outside";

  for (const other of occupiedBounds(items, target.exclude)) {
    if (rectsOverlap(candidateRect, other)) return "taken";
  }

  const exitZones: Bounds[] = [southDoorClear(room)];
  if (accessible) {
    exitZones.push(...accessibleRouteRects(room, routeSpec(items, room, true)));
  }
  for (const zone of exitZones) {
    if (rectsOverlap(candidateRect, zone)) return "blocks_exit";
  }

  return null;
}
