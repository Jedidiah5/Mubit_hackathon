import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec } from "../types";
import {
  CHAIRS_PER_ROUND,
  CHAIR_RADIUS_M,
  TABLE_DIAMETER_M,
  TABLE_SPACING_M,
  gridCentres,
  item,
  placeFeatures,
  placeOverflow,
  seatingBounds,
} from "./shared";

/** 10-seat round tables, 1.8 m diameter, 3 m centres. */
export function layoutBanquet(room: Room, spec: Spec): LayoutItem[] {
  const cap = effectiveCapacity(room, spec);
  const seated = Math.min(spec.guests, cap);
  const overflow = Math.max(0, spec.guests - seated);
  const tablesNeeded = Math.max(1, Math.ceil(seated / CHAIRS_PER_ROUND));

  const bounds = seatingBounds(room, spec);
  const minSpacing = TABLE_DIAMETER_M + (spec.accessible ? 1.5 : 0.8);
  let spacing = TABLE_SPACING_M;
  let centres = gridCentres(bounds, spacing, tablesNeeded);
  while (centres.length < tablesNeeded && spacing > minSpacing + 0.01) {
    spacing = Math.max(minSpacing, spacing - 0.15);
    centres = gridCentres(bounds, spacing, tablesNeeded);
  }
  if (centres.length === 0) centres = [{ x: 0, z: 0 }];

  const tableCentres = centres.slice(0, tablesNeeded);
  let remaining = seated;
  const items: LayoutItem[] = [...placeFeatures(room, spec)];

  for (const { x, z } of tableCentres) {
    items.push(item("table_round", x, z, 0));
    const guestsHere = Math.min(CHAIRS_PER_ROUND, remaining);
    remaining -= guestsHere;
    let guestLeft = guestsHere;

    for (let i = 0; i < CHAIRS_PER_ROUND; i++) {
      const angle = (i / CHAIRS_PER_ROUND) * Math.PI * 2 - Math.PI / 2;
      const cx = x + Math.sin(angle) * CHAIR_RADIUS_M;
      const cz = z + Math.cos(angle) * CHAIR_RADIUS_M;
      const rotY = Math.atan2(x - cx, z - cz);
      items.push(item("chair", cx, cz, rotY));
      if (guestLeft > 0) {
        items.push(item("guest_seated", cx, cz, rotY));
        guestLeft -= 1;
      }
    }
  }

  if (remaining > 0) {
    items.push(...placeOverflow(room, remaining));
  }
  items.push(...placeOverflow(room, overflow));
  return items;
}
