export const STYLES = ["banquet", "cabaret", "theatre", "reception"] as const;
export const WALLS = ["none", "north", "south", "east", "west"] as const;
export const EXTRAS = [
  "dance_floor",
  "dj_booth",
  "projector",
  "lectern",
  "buffet",
  "photo_booth",
] as const;

export type Style = (typeof STYLES)[number];
export type Wall = (typeof WALLS)[number];
export type Extra = (typeof EXTRAS)[number];

/** Model output. Frozen shape — see CONTEXT.md §4. */
export type Spec = {
  style: Style;
  guests: number;
  stage: Wall;
  bar: Wall;
  extras: Extra[];
  accessible: boolean;
};

/** venues/{venueId} */
export type Venue = {
  name: string;
};

/** rooms/{roomId} */
export type Room = {
  venueId: string;
  name: string;
  widthM: number;
  lengthM: number;
  capacity: Record<Style, number>;
  stepFree: boolean;
  hasStage: boolean;
  hasAV: boolean;
  hasBar: boolean;
  rules: string[];
};

export type FeasibilityStatus = "fits" | "warning" | "cannot";

/** Result of lib/feasibility.ts */
export type Feasibility = {
  status: FeasibilityStatus;
  room: Room | null;
  used: number;
  capacity: number;
  notes: string[];
};

/** Raw inbound fields — written before /api/parse runs. */
export type EnquiryInbound = {
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
};

/** enquiries/{id} — parse fields appear once processed. */
export type Enquiry = EnquiryInbound & {
  parsed?: Spec;
  requestId?: string;
  latencyMs?: number;
  model?: string;
  final?: Spec;
  feasibility?: Feasibility;
  status?: FeasibilityStatus;
  /** Manual room pick by name; clears when empty → bestRoom again. */
  roomOverride?: string | null;
};

export type EnquiryListItem = Enquiry & { id: string };

/** corrections/{id} — from/to are the previous and next value of `field`. */
export type Correction = {
  [K in keyof Spec]: {
    enquiryId: string;
    requestId: string;
    field: K;
    from: Spec[K];
    to: Spec[K];
    at: string;
  };
}[keyof Spec];

export const LAYOUT_KINDS = [
  "table_round",
  "chair",
  "high_table",
  "stage",
  "bar",
  "dance_floor",
  "dj_booth",
  "photo_booth",
  "buffet",
  "lectern",
  "projector",
  "guest_seated",
  "guest_standing",
  "guest_overflow",
] as const;

export type LayoutKind = (typeof LAYOUT_KINDS)[number];

/** Placed item from lib/layout. Metres, y rotation in radians. Origin = room centre, north = −z. */
export type LayoutItem = {
  kind: LayoutKind;
  x: number;
  z: number;
  rotY: number;
};
