import { bestRoom, check } from "./feasibility";
import type { Feasibility, Room, Spec } from "./types";

/** bestRoom, or check() against a named override. */
export function evaluateRooms(
  rooms: Room[],
  spec: Spec,
  roomOverride?: string | null,
): Feasibility {
  if (roomOverride) {
    const room = rooms.find((r) => r.name === roomOverride);
    if (room) {
      const result = check(room, spec);
      return {
        status: result.status,
        room,
        used: result.used,
        capacity: result.capacity,
        notes: result.notes,
      };
    }
  }
  return bestRoom(rooms, spec);
}
