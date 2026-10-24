import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec, Wall } from "../types";
import {
  CHAIR_RADIUS_M,
  TABLE_DIAMETER_M,
  TABLE_SPACING_M,
  centredGrid,
  item,
  placeFeatures,
  placeOverflow,
  seatingBounds,
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
  const overflow = Math.max(0, spec.guests - seated);
  const tablesNeeded = Math.max(1, Math.ceil(seated / CHAIRS_PER_CABARET));
  const wall = stageWall(spec);
  const n = wallNormal(wall);

  const bounds = seatingBounds(room, spec);
  const minSpacing = TABLE_DIAMETER_M + (spec.accessible ? 1.5 : 0.8);
  let spacing = TABLE_SPACING_M;
  let centres = centredGrid(bounds, spacing, tablesNeeded);
  while (centres.length < tablesNeeded && spacing > minSpacing + 0.01) {
    spacing = Math.max(minSpacing, spacing - 0.15);
    centres = centredGrid(bounds, spacing, tablesNeeded);
  }
  if (centres.length === 0) centres = [{ x: 0, z: 0 }];

  let remaining = seated;
  const items: LayoutItem[] = [...placeFeatures(room, spec)];

  for (const { x, z } of centres.slice(0, tablesNeeded)) {
    items.push(item("table_round", x, z, 0));
    const guestsHere = Math.min(CHAIRS_PER_CABARET, remaining);
    remaining -= guestsHere;
    let guestLeft = guestsHere;

    // Half-ring opening toward the stage (along -n from table = toward stage).
    for (let i = 0; i < CHAIRS_PER_CABARET; i++) {
      const t = i / Math.max(CHAIRS_PER_CABARET - 1, 1);
      // Sweep ±90° around the direction facing the stage.
      const base = Math.atan2(-n.x, -n.z);
      const angle = base - Math.PI / 2 + t * Math.PI;
      const cx = x + Math.sin(angle) * CHAIR_RADIUS_M;
      const cz = z + Math.cos(angle) * CHAIR_RADIUS_M;
      const rotY = Math.atan2(-n.x, -n.z); // face the stage
      items.push(item("chair", cx, cz, rotY));
      if (guestLeft > 0) {
        items.push(item("guest_seated", cx, cz, rotY));
        guestLeft -= 1;
      }
    }
  }

  if (remaining > 0) items.push(...placeOverflow(room, remaining));
  items.push(...placeOverflow(room, overflow));
  return items;
}
