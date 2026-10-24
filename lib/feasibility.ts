import type {
  Extra,
  Feasibility,
  FeasibilityStatus,
  Room,
  Spec,
  Style,
} from "./types";

/** Stage footprint when the room has no built-in stage. */
const STAGE_DEPTH_M = 2.5;
const STAGE_MIN_SPAN_M = 6;
/** Soft over-capacity band: warn instead of cannot. */
const SOFT_OVER_FRAC = 0.15;
/** used / capacity above this still "fits", but UI shows "· tight". */
export const TIGHT_FRAC = 0.95;

/** True when the booking fits but is above 95% of capacity. */
export function isTight(used: number, capacity: number): boolean {
  return capacity > 0 && used <= capacity && used > capacity * TIGHT_FRAC;
}

function hasExtra(extras: Extra[], extra: Extra): boolean {
  return extras.includes(extra);
}

/**
 * Style capacity with extras modifiers.
 * dance floor −8%, buffet −3%, photo booth −1.
 * Stage −3% is applied in {@link effectiveCapacity} when `spec.stage !== "none"`.
 */
export function capacity(
  room: Room,
  style: Style,
  extras: Extra[],
): number {
  let cap = room.capacity[style];
  if (hasExtra(extras, "dance_floor")) cap *= 0.92;
  if (hasExtra(extras, "buffet")) cap *= 0.97;
  if (hasExtra(extras, "photo_booth")) cap -= 1;
  return Math.max(0, Math.floor(cap));
}

/** Capacity after extras and an optional stage. */
export function effectiveCapacity(room: Room, spec: Spec): number {
  let cap = capacity(room, spec.style, spec.extras);
  if (spec.stage !== "none") cap = Math.floor(cap * 0.97);
  return Math.max(0, cap);
}

function capacityWithoutDance(room: Room, spec: Spec): number {
  const extras = spec.extras.filter((e) => e !== "dance_floor");
  let cap = capacity(room, spec.style, extras);
  if (spec.stage !== "none") cap = Math.floor(cap * 0.97);
  return Math.max(0, cap);
}

function stageFloorOk(room: Room): boolean {
  const span = Math.max(room.widthM, room.lengthM);
  const depth = Math.min(room.widthM, room.lengthM);
  return span >= STAGE_MIN_SPAN_M && depth >= STAGE_DEPTH_M + 4;
}

function softOverCapacity(used: number, cap: number): boolean {
  return used > cap && used <= cap * (1 + SOFT_OVER_FRAC);
}

/**
 * Soft and hard checks for one room. Notes are human-readable reasons.
 * Guests ≤15% over capacity → warning (not cannot).
 */
export function check(
  room: Room,
  spec: Spec,
): {
  status: FeasibilityStatus;
  notes: string[];
  used: number;
  capacity: number;
} {
  const notes: string[] = [];
  const cap = effectiveCapacity(room, spec);
  const used = spec.guests;
  let hardFail = false;
  let warning = false;

  if (hasExtra(spec.extras, "dance_floor")) {
    notes.push("dance floor −8% capacity");
  }
  if (hasExtra(spec.extras, "buffet")) {
    notes.push("buffet −3% capacity");
  }
  if (hasExtra(spec.extras, "photo_booth")) {
    notes.push("photo booth −1 capacity");
  }
  if (spec.stage !== "none") {
    notes.push("stage −3% capacity");
  }

  if (spec.accessible && !room.stepFree) {
    notes.push("needs step-free access");
    hardFail = true;
  }

  if (hasExtra(spec.extras, "projector") && !room.hasAV) {
    notes.push("projector needs AV");
    hardFail = true;
  }

  if (spec.stage !== "none") {
    if (!room.hasStage) {
      if (stageFloorOk(room)) {
        // Informational — still fits if capacity is OK.
        notes.push("no built-in stage — using floor space");
      } else {
        notes.push("no stage and not enough floor space");
        hardFail = true;
      }
    }
  }

  if (spec.bar !== "none" && !room.hasBar) {
    // Informational — portable bar, still fits.
    notes.push("bar requested — portable bar");
  }

  // "Needs a change" only when used > capacity (soft band ≤15% over).
  if (used > cap) {
    if (softOverCapacity(used, cap)) {
      notes.push(`reduce to ${cap} guests`);
      if (hasExtra(spec.extras, "dance_floor")) {
        const without = capacityWithoutDance(room, spec);
        const gain = without - cap;
        if (gain > 0) {
          notes.push(`remove dance floor (+${gain})`);
        }
      }
      warning = true;
    } else {
      notes.push(`${used} guests over capacity ${cap}`);
      hardFail = true;
    }
  } else if (isTight(used, cap)) {
    notes.push("near capacity");
  }

  const status: FeasibilityStatus = hardFail
    ? "cannot"
    : warning
      ? "warning"
      : "fits";

  return { status, notes, used, capacity: cap };
}

function area(room: Room): number {
  return room.widthM * room.lengthM;
}

function scoreRoom(room: Room, spec: Spec): number {
  const result = check(room, spec);
  const statusRank =
    result.status === "fits" ? 0 : result.status === "warning" ? 1 : 2;
  const headroom = Math.abs(result.capacity - spec.guests);
  if (result.status === "cannot") {
    return statusRank * 1e9 + headroom * 1e3 + area(room) * 0.01;
  }
  return statusRank * 1e9 + area(room) * 1e3 + headroom;
}

function enrichSuggestions(
  rooms: Room[],
  chosen: Room,
  spec: Spec,
  result: ReturnType<typeof check>,
): string[] {
  const notes = [...result.notes];
  if (result.status !== "warning" && result.status !== "cannot") return notes;

  const others = rooms.filter((r) => r.name !== chosen.name);
  const nextFit = [...others]
    .map((r) => ({ room: r, check: check(r, spec) }))
    .filter(
      (x) => x.check.status === "fits" || x.check.status === "warning",
    )
    .sort((a, b) => scoreRoom(a.room, spec) - scoreRoom(b.room, spec))[0];

  if (
    nextFit &&
    !notes.some((n) => n.includes(nextFit.room.name))
  ) {
    notes.push(
      `try ${nextFit.room.name} (${nextFit.check.capacity} ${spec.style})`,
    );
  }

  return notes;
}

/**
 * Smallest room that fits (or warns); otherwise the closest "cannot" option.
 * Only "cannot" when no room works even with soft suggestions.
 */
export function bestRoom(rooms: Room[], spec: Spec): Feasibility {
  if (rooms.length === 0) {
    return {
      status: "cannot",
      room: null,
      used: spec.guests,
      capacity: 0,
      notes: ["no rooms configured"],
    };
  }

  const ranked = [...rooms].sort(
    (a, b) => scoreRoom(a, spec) - scoreRoom(b, spec),
  );
  const room =
    ranked.find((r) => {
      const c = check(r, spec);
      return c.status === "fits" || c.status === "warning";
    }) ?? ranked[0]!;
  const result = check(room, spec);
  const notes = enrichSuggestions(rooms, room, spec, result);

  return {
    status: result.status,
    room,
    used: result.used,
    capacity: result.capacity,
    notes,
  };
}
