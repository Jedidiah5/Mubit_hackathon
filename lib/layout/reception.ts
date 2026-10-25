import { effectiveCapacity } from "../feasibility";
import type { LayoutItem, Room, Spec } from "../types";
import {
  HIGH_TABLE_CLEARANCE_M,
  blockedRects,
  gridCentres,
  isBlocked,
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
  const overflow = Math.max(0, spec.guests - cap);
  const blocks = blockedRects(room, spec);

  const bounds = seatingBounds(room, spec);
  const tables = gridCentres(bounds, HIGH_TABLE_SPACING).filter(
    (p) => !isBlocked(p.x, p.z, HIGH_TABLE_CLEARANCE_M, blocks),
  );
  const items: LayoutItem[] = [...placeFeatures(room, spec)];

  tables.forEach(({ x, z }, ti) => {
    const id = `table-${ti + 1}`;
    items.push(item("high_table", x, z, 0, id));
  });

  let remaining = standing;
  let standingN = 0;
  const anchors =
    tables.length > 0
      ? tables
      : gridCentres(bounds, 2.5)
          .filter((p) => !isBlocked(p.x, p.z, 0.4, blocks))
          .slice(0, Math.ceil(standing / CLUSTER_MIN));

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
      let x = anchor.x + Math.sin(angle) * radius;
      let z = anchor.z + Math.cos(angle) * radius;
      if (isBlocked(x, z, 0.3, blocks)) {
        x = anchor.x;
        z = anchor.z;
        if (isBlocked(x, z, 0.3, blocks)) continue;
      }
      standingN += 1;
      items.push(
        item(
          "guest_standing",
          x,
          z,
          angle + Math.PI,
          `guest_standing-${standingN}`,
        ),
      );
      remaining -= 1;
    }
    anchorIdx += 1;
    if (anchorIdx > anchors.length + Math.ceil(standing / CLUSTER_MIN)) break;
  }

  if (remaining > 0) {
    const fillers = gridCentres(bounds, 1.2).filter(
      (p) => !isBlocked(p.x, p.z, 0.3, blocks),
    );
    for (let i = 0; i < remaining && i < fillers.length; i++) {
      const p = fillers[i]!;
      standingN += 1;
      items.push(
        item("guest_standing", p.x, p.z, 0, `guest_standing-${standingN}`),
      );
    }
  }

  items.push(...placeOverflow(room, overflow, blocks));
  return items;
}
