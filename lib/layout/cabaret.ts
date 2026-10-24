import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec, Wall } from "../types";
import {
  CHAIR_RADIUS_M,
  blockedRects,
  item,
  packRoundTables,
  placeFeatures,
  placeOverflow,
  wallFacingOut,
  wallNormal,
} from "./shared";

const CHAIRS_PER_CABARET = 6;

function stageWall(spec: Spec): Wall {
  return spec.stage === "none" ? "north" : spec.stage;
}

/** Round tables with chairs only on the half facing the stage. */
export function layoutCabaret(room: Room, spec: Spec): LayoutItem[] {
  const cap = effectiveCapacity(room, spec);
  const seated = Math.min(spec.guests, cap);
  const overflow = Math.max(0, spec.guests - cap);
  const tablesNeeded =
    seated <= 0 ? 0 : Math.max(1, Math.ceil(seated / CHAIRS_PER_CABARET));
  const wall = stageWall(spec);
  const n = wallNormal(wall);
  const blocks = blockedRects(room, spec);

  const centres = packRoundTables(room, spec, tablesNeeded);
  let remaining = seated;
  const items: LayoutItem[] = [...placeFeatures(room, spec)];

  for (const { x, z } of centres) {
    items.push(item("table_round", x, z, 0));
    const guestsHere = Math.min(CHAIRS_PER_CABARET, remaining);
    remaining -= guestsHere;
    let guestLeft = guestsHere;

    for (let i = 0; i < CHAIRS_PER_CABARET; i++) {
      const t = i / Math.max(CHAIRS_PER_CABARET - 1, 1);
      const base = Math.atan2(-n.x, -n.z);
      const angle = base - Math.PI / 2 + t * Math.PI;
      const cx = x + Math.sin(angle) * CHAIR_RADIUS_M;
      const cz = z + Math.cos(angle) * CHAIR_RADIUS_M;
      const rotY = wallFacingOut(wall);
      items.push(item("chair", cx, cz, rotY));
      if (guestLeft > 0) {
        items.push(item("guest_seated", cx, cz, rotY));
        guestLeft -= 1;
      }
    }
  }

  items.push(...placeOverflow(room, overflow, blocks));
  return items;
}
