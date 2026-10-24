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

function hasExtra(extras: Extra[], extra: Extra): boolean {
  return extras.includes(extra);
}

/**
 * Style capacity with extras modifiers.
 * dance floor −10%, buffet −5%, photo booth −2.
 * Stage −5% is applied in {@link effectiveCapacity} when `spec.stage !== "none"`.
 */
export function capacity(
  room: Room,
  style: Style,
  extras: Extra[],
): number {
  let cap = room.capacity[style];
  if (hasExtra(extras, "dance_floor")) cap *= 0.9;
  if (hasExtra(extras, "buffet")) cap *= 0.95;
  if (hasExtra(extras, "photo_booth")) cap -= 2;
  return Math.max(0, Math.floor(cap));
}

/** Capacity after extras and an optional stage. */
export function effectiveCapacity(room: Room, spec: Spec): number {
  let cap = capacity(room, spec.style, spec.extras);
  if (spec.stage !== "none") cap = Math.floor(cap * 0.95);
  return Math.max(0, cap);
}

function stageFloorOk(room: Room): boolean {
  const span = Math.max(room.widthM, room.lengthM);
  const depth = Math.min(room.widthM, room.lengthM);
  return span >= STAGE_MIN_SPAN_M && depth >= STAGE_DEPTH_M + 4;
}

/**
 * Soft and hard checks for one room. Notes are human-readable reasons.
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
    notes.push("dance floor −10% capacity");
  }
  if (hasExtra(spec.extras, "buffet")) {
    notes.push("buffet −5% capacity");
  }
  if (hasExtra(spec.extras, "photo_booth")) {
    notes.push("photo booth −2 capacity");
  }
  if (spec.stage !== "none") {
    notes.push("stage −5% capacity");
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
        notes.push("no built-in stage — using floor space");
        warning = true;
      } else {
        notes.push("no stage and not enough floor space");
        hardFail = true;
      }
    }
  }

  if (spec.bar !== "none" && !room.hasBar) {
    notes.push("bar requested — portable bar");
    warning = true;
  }

  if (used > cap) {
    notes.push(`${used} guests over capacity ${cap}`);
    hardFail = true;
  } else if (used > cap * 0.9) {
    notes.push("near capacity");
    warning = true;
  }

  const base = room.capacity[spec.style];
  if (!hardFail && used <= cap && used > Math.floor(base * 0.9) && cap < base) {
    warning = true;
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
  return statusRank * 1e9 + area(room) * 1e3 + headroom;
}

/**
 * Smallest room that fits (or warns); otherwise the closest "cannot" option.
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
  const room = ranked[0]!;
  const result = check(room, spec);
  return {
    status: result.status,
    room,
    used: result.used,
    capacity: result.capacity,
    notes: result.notes,
  };
}
