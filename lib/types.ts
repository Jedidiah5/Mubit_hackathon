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

/** enquiries/{id} */
export type Enquiry = {
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  parsed: Spec;
  requestId: string;
  latencyMs: number;
  model: string;
  final: Spec;
  feasibility: Feasibility;
  status: FeasibilityStatus;
};

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

/** Placed item from lib/layout. Metres, y rotation in radians. */
export type LayoutItem = {
  kind: string;
  x: number;
  z: number;
  rotY: number;
};
