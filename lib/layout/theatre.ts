import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec, Wall } from "../types";
import {
  THEATRE_AISLE_M,
  blockedRects,
  isBlocked,
  item,
  placeFeatures,
  placeOverflow,
  seatingBounds,
  wallFacingOut,
  wallNormal,
  type Bounds,
} from "./shared";

const CHAIR_W = 0.55;
const ROW_PITCH = 0.95;

function stageWall(spec: Spec): Wall {
  return spec.stage === "none" ? "north" : spec.stage;
}

/** Rows of chairs facing the stage wall with a 1.2 m centre aisle. */
export function layoutTheatre(room: Room, spec: Spec): LayoutItem[] {
  const cap = effectiveCapacity(room, spec);
  const seated = Math.min(spec.guests, cap);
  const overflow = Math.max(0, spec.guests - cap);
  const wall = stageWall(spec);
  const face = wallFacingOut(wall);
  const n = wallNormal(wall);
  const bounds = seatingBounds(room, spec);
  const blocks = blockedRects(room, spec);

  const items: LayoutItem[] = [...placeFeatures(room, spec)];
  const alongX = wall === "north" || wall === "south";

  const rowStarts: { x: number; z: number }[] = [];
  if (alongX) {
    const z0 = n.z < 0 ? bounds.minZ : bounds.maxZ;
    const zDir = n.z < 0 ? 1 : -1;
    for (
      let z = z0 + zDir * (ROW_PITCH * 0.5);
      zDir > 0 ? z <= bounds.maxZ : z >= bounds.minZ;
      z += zDir * ROW_PITCH
    ) {
      rowStarts.push({ x: 0, z });
    }
  } else {
    const x0 = n.x < 0 ? bounds.minX : bounds.maxX;
    const xDir = n.x < 0 ? 1 : -1;
    for (
      let x = x0 + xDir * (ROW_PITCH * 0.5);
      xDir > 0 ? x <= bounds.maxX : x >= bounds.minX;
      x += xDir * ROW_PITCH
    ) {
      rowStarts.push({ x, z: 0 });
    }
  }

  let remaining = seated;
  const halfAisle = THEATRE_AISLE_M / 2;

  for (const row of rowStarts) {
    if (remaining <= 0) break;

    if (alongX) {
      const leftMax = -halfAisle - CHAIR_W / 2;
      const rightMin = halfAisle + CHAIR_W / 2;
      const leftSeats = placeSide(
        bounds.minX + CHAIR_W / 2,
        leftMax,
        row.z,
        true,
        face,
        remaining,
        items,
        blocks,
      );
      remaining -= leftSeats;
      if (remaining <= 0) break;
      const rightSeats = placeSide(
        rightMin,
        bounds.maxX - CHAIR_W / 2,
        row.z,
        true,
        face,
        remaining,
        items,
        blocks,
      );
      remaining -= rightSeats;
    } else {
      const topMax = -halfAisle - CHAIR_W / 2;
      const botMin = halfAisle + CHAIR_W / 2;
      const a = placeSide(
        bounds.minZ + CHAIR_W / 2,
        topMax,
        row.x,
        false,
        face,
        remaining,
        items,
        blocks,
      );
      remaining -= a;
      if (remaining <= 0) break;
      const b = placeSide(
        botMin,
        bounds.maxZ - CHAIR_W / 2,
        row.x,
        false,
        face,
        remaining,
        items,
        blocks,
      );
      remaining -= b;
    }
  }

  items.push(...placeOverflow(room, overflow, blocks));
  return items;
}

function placeSide(
  from: number,
  to: number,
  fixed: number,
  alongX: boolean,
  face: number,
  budget: number,
  items: LayoutItem[],
  blocks: Bounds[],
): number {
  if (to < from || budget <= 0) return 0;
  const span = to - from;
  const slots = Math.max(0, Math.floor(span / CHAIR_W) + 1);
  if (slots === 0) return 0;
  const used = (slots - 1) * CHAIR_W;
  const start = from + (span - used) / 2;
  let placed = 0;
  for (let i = 0; i < slots && placed < budget; i++) {
    const along = start + i * CHAIR_W;
    const x = alongX ? along : fixed;
    const z = alongX ? fixed : along;
    if (isBlocked(x, z, CHAIR_W * 0.4, blocks)) continue;
    items.push(item("chair", x, z, face));
    items.push(item("guest_seated", x, z, face));
    placed += 1;
  }
  return placed;
}
