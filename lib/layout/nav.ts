import type { LayoutItem, Room } from "../types";
import { TABLE_GROUP_SIZE, footprintBounds, footprintSize } from "./footprint";
import type { Bounds, Point } from "./shared";

/**
 * Walkable floor for guests who move around: a grid of square cells, each
 * blocked or free. Built from the same footprints the editor uses, so moved
 * tables and added signs / TVs are walked around automatically.
 */
export type NavGrid = {
  cell: number;
  cols: number;
  rows: number;
  minX: number;
  minZ: number;
  blocked: Uint8Array;
};

/** Half a walking guest's width: obstacles grow by this much. */
const AGENT_RADIUS_M = 0.25;
/** Keep walkers this far off the walls. */
const WALL_MARGIN_M = 0.4;
/**
 * Space a standing (still) guest takes up. People shift to let someone past,
 * so only their body counts: with the walker's radius that's 35 cm, enough
 * to slip between two guests chatting a metre apart.
 */
const PERSON_RADIUS_M = 0.1;

/** Walkable floor pieces: you can walk over these. */
const WALKABLE = new Set<LayoutItem["kind"]>(["dance_floor", "projector"]);

type Shape =
  | { disc: true; x: number; z: number; r: number }
  | { disc: false; rect: Bounds };

function shapeOf(it: LayoutItem, room: Room): Shape | null {
  if (WALKABLE.has(it.kind)) return null;
  switch (it.kind) {
    case "table_round":
      // Table plus its ring of chairs.
      return { disc: true, x: it.x, z: it.z, r: TABLE_GROUP_SIZE.w / 2 + 0.1 };
    case "high_table":
      return { disc: true, x: it.x, z: it.z, r: 0.5 };
    case "chair":
    case "guest_seated":
      // Grouped chairs / guests are inside their table's disc.
      return it.groupId ? null : { disc: true, x: it.x, z: it.z, r: 0.3 };
    case "guest_standing":
    case "guest_overflow":
      return { disc: true, x: it.x, z: it.z, r: PERSON_RADIUS_M };
    default:
      return {
        disc: false,
        rect: footprintBounds(
          it.x,
          it.z,
          footprintSize(it.kind, room, it.rotY),
          it.rotY,
        ),
      };
  }
}

/** Grid for `items` in `room`; anything in `ignore` (the walkers) is left out. */
export function buildNavGrid(
  items: LayoutItem[],
  room: Room,
  { cell = 0.25, ignore }: { cell?: number; ignore?: Set<string> } = {},
): NavGrid {
  const hx = room.widthM / 2;
  const hz = room.lengthM / 2;
  const cols = Math.ceil(room.widthM / cell);
  const rows = Math.ceil(room.lengthM / cell);
  const blocked = new Uint8Array(cols * rows);
  const grid: NavGrid = { cell, cols, rows, minX: -hx, minZ: -hz, blocked };

  const shapes = items
    .filter((it) => !ignore?.has(it.id))
    .map((it) => shapeOf(it, room))
    .filter((s): s is Shape => s !== null);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { x, z } = cellCentre(grid, c, r);
      let hit =
        Math.abs(x) > hx - WALL_MARGIN_M || Math.abs(z) > hz - WALL_MARGIN_M;
      for (let i = 0; !hit && i < shapes.length; i++) {
        const s = shapes[i]!;
        if (s.disc) {
          hit = Math.hypot(x - s.x, z - s.z) < s.r + AGENT_RADIUS_M;
        } else {
          const b = s.rect;
          hit =
            x > b.minX - AGENT_RADIUS_M &&
            x < b.maxX + AGENT_RADIUS_M &&
            z > b.minZ - AGENT_RADIUS_M &&
            z < b.maxZ + AGENT_RADIUS_M;
        }
      }
      blocked[r * cols + c] = hit ? 1 : 0;
    }
  }
  return grid;
}

function cellCentre(g: NavGrid, c: number, r: number): Point {
  return { x: g.minX + (c + 0.5) * g.cell, z: g.minZ + (r + 0.5) * g.cell };
}

function cellOf(g: NavGrid, p: Point): { c: number; r: number } {
  return {
    c: Math.min(g.cols - 1, Math.max(0, Math.floor((p.x - g.minX) / g.cell))),
    r: Math.min(g.rows - 1, Math.max(0, Math.floor((p.z - g.minZ) / g.cell))),
  };
}

function free(g: NavGrid, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];
}

export function isFree(g: NavGrid, p: Point): boolean {
  const { c, r } = cellOf(g, p);
  return free(g, c, r);
}

/** Centre of the free cell nearest `p` (ring search), or null if none within `maxM`. */
export function nearestFree(g: NavGrid, p: Point, maxM = 6): Point | null {
  const { c, r } = cellOf(g, p);
  if (free(g, c, r)) return cellCentre(g, c, r);
  const maxRing = Math.ceil(maxM / g.cell);
  for (let ring = 1; ring <= maxRing; ring++) {
    let best: { c: number; r: number; d: number } | null = null;
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        if (!free(g, c + dc, r + dr)) continue;
        const d = dc * dc + dr * dr;
        if (!best || d < best.d) best = { c: c + dc, r: r + dr, d };
      }
    }
    if (best) return cellCentre(g, best.c, best.r);
  }
  return null;
}

/**
 * True when every cell the straight line a→b passes through is free
 * (grid traversal, so it can't skip a corner between samples). The cell `a`
 * starts in is not checked: a walker may start inside a crowd.
 */
function clearLine(g: NavGrid, a: Point, b: Point): boolean {
  const fx = (a.x - g.minX) / g.cell;
  const fz = (a.z - g.minZ) / g.cell;
  const dx = (b.x - a.x) / g.cell;
  const dz = (b.z - a.z) / g.cell;
  let { c, r } = cellOf(g, a);
  const end = cellOf(g, b);
  const stepC = Math.sign(dx);
  const stepR = Math.sign(dz);
  const tDeltaC = stepC ? Math.abs(1 / dx) : Infinity;
  const tDeltaR = stepR ? Math.abs(1 / dz) : Infinity;
  let tMaxC = stepC ? ((stepC > 0 ? c + 1 : c) - fx) / dx : Infinity;
  let tMaxR = stepR ? ((stepR > 0 ? r + 1 : r) - fz) / dz : Infinity;
  while (c !== end.c || r !== end.r) {
    if (Math.abs(tMaxC - tMaxR) < 1e-9) {
      // Exactly through a corner: both neighbours must be free too.
      if (!free(g, c + stepC, r) || !free(g, c, r + stepR)) return false;
      c += stepC;
      r += stepR;
      tMaxC += tDeltaC;
      tMaxR += tDeltaR;
    } else if (tMaxC < tMaxR) {
      c += stepC;
      tMaxC += tDeltaC;
    } else {
      r += stepR;
      tMaxR += tDeltaR;
    }
    if (tMaxC > 1 + tDeltaC && tMaxR > 1 + tDeltaR) break;
    if (!free(g, c, r)) return false;
  }
  return true;
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

/**
 * Shortest route from `from` to `to` through free cells (A*, 8 directions,
 * no cutting blocked corners), straightened wherever there's a clear line.
 * Returns the waypoints after `from`, ending at `to`; null if unreachable.
 * A blocked start (a guest standing in a crowd) steps to the nearest free cell.
 */
export function findPath(g: NavGrid, from: Point, to: Point): Point[] | null {
  const startP = nearestFree(g, from, 2);
  const goalP = nearestFree(g, to, 2);
  if (!startP || !goalP) return null;
  const s = cellOf(g, startP);
  const t = cellOf(g, goalP);
  const n = g.cols * g.rows;
  const start = s.r * g.cols + s.c;
  const goal = t.r * g.cols + t.c;

  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const h = (i: number) => {
    const c = i % g.cols;
    const r = (i - c) / g.cols;
    const dx = Math.abs(c - t.c);
    const dr = Math.abs(r - t.r);
    return Math.max(dx, dr) + (Math.SQRT2 - 1) * Math.min(dx, dr);
  };
  // Small binary heap of [f, index].
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p]![0] <= heap[k]![0]) break;
      [heap[p], heap[k]] = [heap[k]!, heap[p]!];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        k = m;
      }
    }
    return top;
  };

  gScore[start] = 0;
  push(h(start), start);
  while (heap.length > 0) {
    const [, i] = pop();
    if (closed[i]) continue;
    if (i === goal) break;
    closed[i] = 1;
    const c = i % g.cols;
    const r = (i - c) / g.cols;
    for (const [dc, dr, cost] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!free(g, nc, nr)) continue;
      // No squeezing diagonally between two blocked cells.
      if (dc && dr && (!free(g, c + dc, r) || !free(g, c, r + dr))) continue;
      const j = nr * g.cols + nc;
      const tentative = gScore[i]! + cost;
      if (tentative < gScore[j]!) {
        gScore[j] = tentative;
        came[j] = i;
        push(tentative + h(j), j);
      }
    }
  }
  if (start !== goal && came[goal] === -1) return null;

  const cells: Point[] = [];
  for (let i = goal; i !== -1 && i !== start; i = came[i]!) {
    cells.push(cellCentre(g, i % g.cols, Math.floor(i / g.cols)));
  }
  cells.reverse();
  if (isFree(g, to)) cells[cells.length - 1] = to;
  if (cells.length === 0) return [goalP];

  // String-pull: from each kept point, jump to the furthest point in sight.
  const out: Point[] = [];
  let anchor = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) {
      if (clearLine(g, anchor, cells[j]!)) {
        far = j;
        break;
      }
    }
    out.push(cells[far]!);
    anchor = cells[far]!;
    k = far + 1;
  }
  return out;
}

/** Free cell centres, for picking somewhere to wander to. */
export function freeCells(g: NavGrid): Point[] {
  const out: Point[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (free(g, c, r)) out.push(cellCentre(g, c, r));
    }
  }
  return out;
}
