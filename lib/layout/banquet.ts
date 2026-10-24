import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec } from "../types";
import {
  CHAIRS_PER_ROUND,
  CHAIR_RADIUS_M,
  TABLE_DIAMETER_M,
  TABLE_SPACING_M,
  centredGrid,
  danceFloorPosition,
  item,
  overlapsDance,
  placeFeatures,
  placeOverflow,
  seatingBounds,
} from "./shared";

/** 10-seat round tables, 1.8 m diameter, 3 m centres — grid centred in free floor. */
export function layoutBanquet(room: Room, spec: Spec): LayoutItem[] {
  const cap = effectiveCapacity(room, spec);
  const seated = Math.min(spec.guests, cap);
  const overflow = Math.max(0, spec.guests - seated);
  const tablesNeeded = Math.max(1, Math.ceil(seated / CHAIRS_PER_ROUND));
  const hasDance = spec.extras.includes("dance_floor");
  const dance = hasDance ? danceFloorPosition(room, spec) : null;

  // Free floor = room minus stage/bar; dance is carved by overlap filter so
  // tables can sit around a centre-front pad rather than only behind it.
  const bounds = seatingBounds(room, spec, { reserveDance: false });
  const minSpacing = TABLE_DIAMETER_M + (spec.accessible ? 1.5 : 0.8);
  let spacing = TABLE_SPACING_M;
  let centres = centredGrid(bounds, spacing, tablesNeeded);

  const pack = (space: number) => {
    let raw = centredGrid(bounds, space, Math.max(tablesNeeded * 3, 24));
    if (dance) {
      raw = raw.filter((p) => !overlapsDance(p.x, p.z, dance));
    }
    if (raw.length === 0) {
      return dance
        ? centredGrid(bounds, space, tablesNeeded).filter(
            (p) => !overlapsDance(p.x, p.z, dance),
          )
        : centredGrid(bounds, space, tablesNeeded);
    }
    // Prefer slots farther from the dance centre (ring around the pad).
    if (dance) {
      raw = [...raw].sort((a, b) => {
        const da = (a.x - dance.x) ** 2 + (a.z - dance.z) ** 2;
        const db = (b.x - dance.x) ** 2 + (b.z - dance.z) ** 2;
        return da - db;
      });
    }
    const pick = raw.slice(0, tablesNeeded);
    const meanX = pick.reduce((s, p) => s + p.x, 0) / pick.length;
    const meanZ = pick.reduce((s, p) => s + p.z, 0) / pick.length;
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midZ = (bounds.minZ + bounds.maxZ) / 2;
    let shifted = pick.map((p) => ({
      x: p.x + (midX - meanX),
      z: p.z + (midZ - meanZ),
    }));
    if (dance) {
      shifted = shifted.filter((p) => !overlapsDance(p.x, p.z, dance));
      // If recentre pushed into the pad, keep the unshifted pick.
      if (shifted.length < Math.min(tablesNeeded, pick.length)) {
        return pick;
      }
    }
    return shifted;
  };

  centres = pack(spacing);
  while (centres.length < tablesNeeded && spacing > minSpacing + 0.01) {
    spacing = Math.max(minSpacing, spacing - 0.15);
    centres = pack(spacing);
  }
  if (centres.length === 0) {
    centres = [
      {
        x: (bounds.minX + bounds.maxX) / 2,
        z: (bounds.minZ + bounds.maxZ) / 2,
      },
    ];
  }

  const tableCentres = centres.slice(0, tablesNeeded);
  let remaining = seated;
  const items: LayoutItem[] = [
    ...placeFeatures(room, spec, { skipDance: false }),
  ];

  // Ensure dance pad is present for banquet when requested.
  if (hasDance && dance && !items.some((i) => i.kind === "dance_floor")) {
    items.push(item("dance_floor", dance.x, dance.z, 0));
  }

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

  if (remaining > 0) items.push(...placeOverflow(room, remaining));
  items.push(...placeOverflow(room, overflow));
  return items;
}
