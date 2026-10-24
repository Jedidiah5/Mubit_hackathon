import type { LayoutKind } from "@/lib/types";

/** Total build ≤1.5 s: group starts + 500 ms motion (+ ≤150 ms jitter). */
export const BUILD_DURATION_S = 1.5;
export const GROUP_DURATION_S = 0.5;
export const JITTER_S = 0.15;

/** Group start delays (ms → s): walls 0 → tables 300 → chairs 600 → guests 900. */
export type BuildGroup = "walls" | "tables" | "chairs" | "guests";

const GROUP_START_S: Record<BuildGroup, number> = {
  walls: 0,
  tables: 0.3,
  chairs: 0.6,
  guests: 0.9,
};

export function groupFor(kind: LayoutKind): BuildGroup {
  if (kind === "chair") return "chairs";
  if (
    kind === "guest_seated" ||
    kind === "guest_standing" ||
    kind === "guest_overflow"
  ) {
    return "guests";
  }
  if (kind === "table_round" || kind === "high_table") return "tables";
  // stage, bar, dance, booths, lectern, projector → with walls
  return "walls";
}

/** Stable 0–1 pseudo-random from an integer seed (no Math.random in render). */
export function unitNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function jitterFor(seed: number): number {
  return unitNoise(seed) * JITTER_S;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(
    1,
    Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)),
  );
  return t * t * (3 - 2 * t);
}

/**
 * Pop scale for one instance. Delay is group start + per-instance jitter only —
 * never multiplied by item index / count.
 */
export function popScale(
  kind: LayoutKind,
  instanceSeed: number,
  t: number,
): number {
  const start = GROUP_START_S[groupFor(kind)] + jitterFor(instanceSeed);
  return Math.max(0.001, smoothstep(start, start + GROUP_DURATION_S, t));
}
