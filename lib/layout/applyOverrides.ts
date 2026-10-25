import type { LayoutItem, LayoutOverride } from "../types";

function rotateAround(
  x: number,
  z: number,
  cx: number,
  cz: number,
  dRot: number,
): { x: number; z: number } {
  const dx = x - cx;
  const dz = z - cz;
  const cos = Math.cos(dRot);
  const sin = Math.sin(dRot);
  // Yaw about +y: local (+x,+z) → (x cos + z sin, −x sin + z cos) in xz.
  return {
    x: cx + dx * cos + dz * sin,
    z: cz - dx * sin + dz * cos,
  };
}

function tableCentre(group: LayoutItem[]): { x: number; z: number; rotY: number } {
  const table =
    group.find((i) => i.kind === "table_round" || i.kind === "high_table") ??
    group[0]!;
  return { x: table.x, z: table.z, rotY: table.rotY };
}

function applyPose(
  it: LayoutItem,
  override: LayoutOverride,
): LayoutItem {
  return { ...it, x: override.x, z: override.z, rotY: override.rotY };
}

/**
 * Apply manual furniture moves. Empty / missing overrides leave items unchanged.
 * An override keyed by groupId (or the table's id) translates and rotates the
 * whole table group around the table centre.
 */
export function applyOverrides(
  items: LayoutItem[],
  overrides?: Record<string, LayoutOverride> | null,
): LayoutItem[] {
  if (!overrides) return items;
  const keys = Object.keys(overrides);
  if (keys.length === 0) return items;

  let next = items.map((it) => ({ ...it }));

  for (const key of keys) {
    const override = overrides[key]!;
    const group = next.filter((it) => it.groupId === key);
    if (group.length > 0) {
      const centre = tableCentre(group);
      const dRot = override.rotY - centre.rotY;
      const ids = new Set(group.map((g) => g.id));
      next = next.map((it) => {
        if (!ids.has(it.id)) return it;
        const rotated = rotateAround(it.x, it.z, centre.x, centre.z, dRot);
        return {
          ...it,
          x: rotated.x + (override.x - centre.x),
          z: rotated.z + (override.z - centre.z),
          rotY: it.rotY + dRot,
        };
      });
      continue;
    }

    next = next.map((it) =>
      it.id === key ? applyPose(it, override) : it,
    );
  }

  return next;
}
