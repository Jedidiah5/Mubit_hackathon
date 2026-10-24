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

/** Flat / per-head extras priced on a room. */
export type RoomExtrasPricing = {
  dance_floor: number;
  dj_booth: number;
  photo_booth: number;
  projector: number;
  lectern: number;
  /** Charged per guest when `buffet` is in the spec. */
  buffet_per_head: number;
};

/** Instant-quote tariff for a room (£, ex-VAT). */
export type RoomPricing = {
  hireFee: number;
  perHead: Record<Style, number>;
  extras: RoomExtrasPricing;
  minSpend: number;
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
  pricing: RoomPricing;
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
  /** Past corrections sent as notes with the parse call. */
  notesUsed?: number;
  final?: Spec;
  feasibility?: Feasibility;
  status?: FeasibilityStatus;
  /** Manual room pick by name; clears when empty → bestRoom again. */
  roomOverride?: string | null;
};

export type EnquiryListItem = Enquiry & { id: string };

/** One changed field: model value → coordinator value. */
export type SpecChange = {
  [K in keyof Spec]: { field: K; from: Spec[K]; to: Spec[K] };
}[keyof Spec];

/**
 * corrections/{enquiryId} — one doc per enquiry, overwritten on every edit,
 * so it always holds model answer vs coordinator's current answer.
 */
export type Correction = {
  enquiryId: string;
  requestId: string;
  /** Trimmed email, as the model saw it. */
  email: string;
  parsed: Spec;
  final: Spec;
  changes: SpecChange[];
  at: string;
};

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
