import type {
  LayoutItem,
  LayoutKind,
  LayoutOverride,
  Room,
  Spec,
  Wall,
} from "../types";
import {
  TABLE_GROUP_SIZE,
  footprintBounds,
  footprintSize,
  rectInside,
  rectsOverlap,
} from "./footprint";
import {
  HIGH_TABLE_CLEARANCE_M,
  ROUND_TABLE_CLEARANCE_M,
  TABLE_SPACING_MIN_M,
  accessibleRouteRects,
  halfExtents,
  southDoorPad,
  type Bounds,
} from "./shared";

export type PlacementIssue = "outside" | "taken" | "blocks_exit";

/**
 * Chairs travel with their table, people step aside and the projector screen
 * hangs on the wall — none of them blocks a move.
 */
const NON_BLOCKING = new Set<LayoutKind>([
  "projector",
  "chair",
  "guest_seated",
  "guest_standing",
  "guest_overflow",
]);

/** Stage dressing auto-layout stands on the stage — never a clash with it. */
const ON_STAGE = new Set<LayoutKind>(["dj_booth", "lectern", "projector"]);

/**
 * Tables follow the packers' rules so a table is always valid where
 * auto-layout put it: `clear` is the centre clearance from features / exits,
 * `roomHalf` keeps the table (and its chairs) inside the walls, and table
 * centres stay TABLE_SPACING_MIN_M apart on at least one axis.
 */
const TABLE_RULES: Partial<
  Record<LayoutKind, { clear: number; roomHalf: number }>
> = {
  table_round: {
    clear: ROUND_TABLE_CLEARANCE_M,
    roomHalf: TABLE_GROUP_SIZE.w / 2,
  },
  high_table: {
    clear: HIGH_TABLE_CLEARANCE_M,
    roomHalf: HIGH_TABLE_CLEARANCE_M,
  },
};

/** Float slack so grid-packed tables exactly TABLE_SPACING_MIN_M apart pass. */
const EPS = 1e-6;

type Piece = { kind: LayoutKind } & (
  | { table: true; x: number; z: number; clear: number; roomHalf: number }
  | { table: false; rect: Bounds }
);

function square(x: number, z: number, half: number): Bounds {
  return { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half };
}

type Pose = Pick<LayoutOverride, "x" | "z" | "rotY">;

function pieceAt(kind: LayoutKind, pose: Pose, room: Room): Piece {
  const rules = TABLE_RULES[kind];
  if (rules) return { kind, table: true, x: pose.x, z: pose.z, ...rules };
  return {
    kind,
    table: false,
    rect: footprintBounds(
      pose.x,
      pose.z,
      footprintSize(kind, room, pose.rotY),
      pose.rotY,
    ),
  };
}

/** Footprint used against features and exit zones. */
function clearRect(p: Piece): Bounds {
  return p.table ? square(p.x, p.z, p.clear) : p.rect;
}

function piecesClash(a: Piece, b: Piece): boolean {
  if (
    (a.kind === "stage" && ON_STAGE.has(b.kind)) ||
    (b.kind === "stage" && ON_STAGE.has(a.kind))
  ) {
    return false;
  }
  if (a.table && b.table) {
    return (
      Math.abs(a.x - b.x) < TABLE_SPACING_MIN_M - EPS &&
      Math.abs(a.z - b.z) < TABLE_SPACING_MIN_M - EPS
    );
  }
  return rectsOverlap(clearRect(a), clearRect(b));
}

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

/**
 * The piece being moved: its table (for a group) or the item itself. A piece
 * that isn't on the floor yet (being added) needs its `kind`.
 */
function resolveTarget(
  id: string,
  items: LayoutItem[],
  newKind?: LayoutKind,
): { kind: LayoutKind; exclude: Set<string> } | null {
  const group = items.filter((it) => it.groupId === id);
  if (group.length > 0) {
    const table =
      group.find((g) => TABLE_RULES[g.kind]) ?? group[0]!;
    return { kind: table.kind, exclude: new Set(group.map((g) => g.id)) };
  }
  const it = items.find((i) => i.id === id);
  if (it) return { kind: it.kind, exclude: new Set([it.id]) };
  return newKind ? { kind: newKind, exclude: new Set() } : null;
}

/** Everything else on the floor that can block a move, one per table group. */
function obstacles(
  items: LayoutItem[],
  exclude: Set<string>,
  room: Room,
): Piece[] {
  const seenGroups = new Set<string>();
  const out: Piece[] = [];

  for (const it of items) {
    if (exclude.has(it.id) || NON_BLOCKING.has(it.kind)) continue;
    if (it.groupId) {
      if (exclude.has(it.groupId) || seenGroups.has(it.groupId)) continue;
      seenGroups.add(it.groupId);
      const group = items.filter((g) => g.groupId === it.groupId);
      const table = group.find((g) => TABLE_RULES[g.kind]) ?? group[0]!;
      out.push(pieceAt(table.kind, table, room));
      continue;
    }
    out.push(pieceAt(it.kind, it, room));
  }
  return out;
}

/**
 * Whether placing `id` at `candidate` is legal.
 * Returns null when ok, otherwise the first problem found.
 * When `accessible` is true, also keeps the step-free wall route clear.
 * `newKind` names a piece being added that isn't in `items` yet.
 */
export function placementProblem(
  id: string,
  candidate: Pose,
  items: LayoutItem[],
  room: Room,
  accessible = false,
  newKind?: LayoutKind,
): PlacementIssue | null {
  const target = resolveTarget(id, items, newKind);
  if (!target) return "taken";

  const piece = pieceAt(target.kind, candidate, room);

  const { hx, hz } = halfExtents(room);
  const roomRect: Bounds = {
    minX: -hx,
    maxX: hx,
    minZ: -hz,
    maxZ: hz,
  };
  const inRoom = piece.table
    ? square(piece.x, piece.z, piece.roomHalf)
    : piece.rect;
  if (!rectInside(inRoom, roomRect)) return "outside";

  for (const other of obstacles(items, target.exclude, room)) {
    if (piecesClash(piece, other)) return "taken";
  }

  const exitZones: Bounds[] = [southDoorPad(room)];
  if (accessible) {
    exitZones.push(...accessibleRouteRects(room, routeSpec(items, room, true)));
  }
  const own = clearRect(piece);
  for (const zone of exitZones) {
    if (rectsOverlap(own, zone)) return "blocks_exit";
  }

  return null;
}
