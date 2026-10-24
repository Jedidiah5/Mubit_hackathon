import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec } from "../types";
import {
  CHAIRS_PER_ROUND,
  CHAIR_RADIUS_M,
  blockedRects,
  item,
  packBanquetTables,
  placeFeatures,
  placeOverflow,
} from "./shared";

/**
 * 10-seat round tables. Seats everyone feasibility says fits
 * (ceil(min(guests, capacity) / 10) tables). Tables are spread evenly
 * across the free floor and centred on both axes.
 * Overflow only when guests > capacity, queued at the south door.
 */
export function layoutBanquet(room: Room, spec: Spec): LayoutItem[] {
  const cap = effectiveCapacity(room, spec);
  const seated = Math.min(spec.guests, cap);
  const overflow = Math.max(0, spec.guests - cap);
  const tablesNeeded =
    seated <= 0 ? 0 : Math.max(1, Math.ceil(seated / CHAIRS_PER_ROUND));
  const blocks = blockedRects(room, spec);

  const tableCentres = packBanquetTables(room, spec, tablesNeeded);
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

  // Anyone still unseated due to packing edge cases sits at remaining chairs
  // were already allocated; leftover capacity guests shouldn't overflow.
  // Only true over-capacity guests queue at the door.
  items.push(...placeOverflow(room, overflow, blocks));
  return items;
}
