import type { Room, Venue } from "../types";

export const DEMO_VENUE_ID = "wharf-rooms";

export const DEMO_VENUE: Venue = {
  name: "The Wharf Rooms",
};

/** Stable Firestore doc ids for the demo rooms. */
export const DEMO_ROOM_IDS = [
  "thames-hall",
  "garden-room",
  "the-loft",
] as const;

export const DEMO_ROOMS: Room[] = [
  {
    venueId: DEMO_VENUE_ID,
    name: "Thames Hall",
    widthM: 20,
    lengthM: 15,
    capacity: {
      banquet: 140,
      cabaret: 110,
      theatre: 240,
      reception: 280,
    },
    stepFree: true,
    hasStage: true,
    hasAV: true,
    hasBar: true,
    rules: ["Prefer Thames Hall for 80+ seated dinners"],
  },
  {
    venueId: DEMO_VENUE_ID,
    name: "Garden Room",
    widthM: 12,
    lengthM: 10,
    capacity: {
      banquet: 60,
      cabaret: 45,
      theatre: 90,
      reception: 110,
    },
    stepFree: true,
    hasStage: false,
    hasAV: true,
    hasBar: false,
    rules: ["Garden access via east doors"],
  },
  {
    venueId: DEMO_VENUE_ID,
    name: "The Loft",
    widthM: 10,
    lengthM: 8,
    capacity: {
      banquet: 40,
      cabaret: 30,
      theatre: 60,
      reception: 70,
    },
    stepFree: false,
    hasStage: false,
    hasAV: false,
    hasBar: false,
    rules: ["Stairs only — not suitable for wheelchair access"],
  },
];

export type RoomDoc = Room & { id: string };

export function demoRoomsWithIds(): RoomDoc[] {
  return DEMO_ROOMS.map((room, i) => ({
    id: DEMO_ROOM_IDS[i]!,
    ...room,
  }));
}
