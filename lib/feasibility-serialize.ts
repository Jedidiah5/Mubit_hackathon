import type { Feasibility } from "./types";

/** Plain JSON shape safe for Firestore writes. */
export function firestoreFeasibility(f: Feasibility) {
  return {
    status: f.status,
    used: f.used,
    capacity: f.capacity,
    notes: f.notes,
    room: f.room
      ? {
          venueId: f.room.venueId,
          name: f.room.name,
          widthM: f.room.widthM,
          lengthM: f.room.lengthM,
          capacity: f.room.capacity,
          stepFree: f.room.stepFree,
          hasStage: f.room.hasStage,
          hasAV: f.room.hasAV,
          hasBar: f.room.hasBar,
          rules: f.room.rules,
          pricing: f.room.pricing,
        }
      : null,
  };
}
