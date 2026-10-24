import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec } from "../types";
import {
  gridCentres,
  item,
  placeFeatures,
  placeOverflow,
  seatingBounds,
} from "./shared";

const HIGH_TABLE_SPACING = 3.4;
const CLUSTER_MIN = 3;
const CLUSTER_MAX = 5;

/** High tables in a loose grid; standing guests in clusters of 3–5. */
export function layoutReception(room: Room, spec: Spec): LayoutItem[] {
  const cap = effectiveCapacity(room, spec);
  const standing = Math.min(spec.guests, cap);
  const overflow = Math.max(0, spec.guests - standing);

  const bounds = seatingBounds(room, spec);
  const tables = gridCentres(bounds, HIGH_TABLE_SPACING);
  const items: LayoutItem[] = [...placeFeatures(room, spec)];

  for (const { x, z } of tables) {
    items.push(item("high_table", x, z, 0));
  }

  // Clusters near high tables first, then fill remaining floor.
  let remaining = standing;
  const anchors =
    tables.length > 0
      ? tables
      : gridCentres(bounds, 2.5).slice(0, Math.ceil(standing / CLUSTER_MIN));

  let anchorIdx = 0;
  while (remaining > 0 && anchorIdx < Math.max(anchors.length, 1)) {
    const size = Math.min(
      remaining,
      CLUSTER_MIN + (anchorIdx % (CLUSTER_MAX - CLUSTER_MIN + 1)),
    );
    const anchor = anchors[anchorIdx % anchors.length] ?? { x: 0, z: 0 };
    const radius = 1.1;
    for (let i = 0; i < size; i++) {
      const angle = (i / size) * Math.PI * 2 + anchorIdx * 0.4;
      const x = anchor.x + Math.sin(angle) * radius;
      const z = anchor.z + Math.cos(angle) * radius;
      items.push(item("guest_standing", x, z, angle + Math.PI));
    }
    remaining -= size;
    anchorIdx += 1;
    if (anchorIdx > anchors.length + Math.ceil(standing / CLUSTER_MIN)) break;
  }

  // Spill any leftover guests into a loose fill near centre.
  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      const angle = (i / remaining) * Math.PI * 2;
      const r = 1.5 + (i % 3) * 0.4;
      items.push(
        item("guest_standing", Math.sin(angle) * r, Math.cos(angle) * r, angle),
      );
    }
    remaining = 0;
  }

  items.push(...placeOverflow(room, overflow));
  return items;
}
