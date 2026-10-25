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

/** Organiser / coordinator pipeline (not feasibility Fits/Can't host). */
export const PIPELINES = [
  "received",
  "proposed",
  "client_changes",
  "accepted",
] as const;
export type PipelineStatus = (typeof PIPELINES)[number];

/** Manual move of a furniture piece (or table group). Metres, yaw in radians. */
export type LayoutOverride = {
  x: number;
  z: number;
  rotY: number;
};

/** One changed Spec field: from → to. */
export type SpecChange = {
  [K in keyof Spec]: { field: K; from: Spec[K]; to: Spec[K] };
}[keyof Spec];

/** Organiser-submitted tweak waiting on the coordinator. */
export type ChangeRequest = {
  status: "pending" | "accepted" | "dismissed";
  spec: Spec;
  note?: string;
  at: string;
  /** Manual furniture moves from the client plan page (not AI corrections). */
  overrides?: Record<string, LayoutOverride>;
  /** Spec field diffs vs the approved plan (from {@link diffSpec}). */
  diff?: SpecChange[];
  /** Optional venue reply when the request is dismissed (shown to the client). */
  replyNote?: string;
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
  /** Organiser email when source is the public form. */
  email?: string;
  source?: "form" | "email" | "paste" | "inbound" | "seed";
  /** Free-text event type from the form (e.g. Wedding). */
  eventType?: string;
  /** ISO date (yyyy-mm-dd) when known. */
  eventDate?: string;
  parsed?: Spec;
  requestId?: string;
  latencyMs?: number;
  model?: string;
  /** Past corrections sent as notes with the parse call. */
  notesUsed?: number;
  final?: FinalSpec;
  feasibility?: Feasibility;
  /**
   * Pipeline status for the organiser journey.
   * Legacy docs may still hold a FeasibilityStatus here — readers should
   * normalise via {@link pipelineOf}.
   */
  status?: PipelineStatus | FeasibilityStatus;
  /** Manual room pick by name; clears when empty → bestRoom again. */
  roomOverride?: string | null;
  /** Set when the coordinator approves; any later edit clears it (needs review). */
  approvedAt?: string | null;
  /** Client accepted the proposal. */
  acceptedAt?: string | null;
  verdict?: Verdict | null;
  changeRequest?: ChangeRequest | null;
  /** Re-parsed after a similar enquiry's correction, and that changed it. */
  fixedBy?: FixedBy | null;
};

/** Written by /api/ripple: which approved correction changed this draft. */
export type FixedBy = {
  enquiryId: string;
  subject: string;
  at: string;
  /** Old parse → new parse, only the fields the coordinator had corrected. */
  changes: SpecChange[];
};

/** good = approved as the model drafted it; corrected = edited first. */
export type Verdict = "good" | "corrected";

export type EnquiryListItem = Enquiry & { id: string };

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
  /** Who authored the correction — coordinator (default) or client. */
  source?: "coordinator" | "client";
};

/** Normalise enquiry.status to a pipeline value (handles legacy Fits values). */
export function pipelineOf(
  e: Pick<Enquiry, "status" | "approvedAt" | "acceptedAt" | "changeRequest">,
): PipelineStatus {
  if (e.acceptedAt || e.status === "accepted") return "accepted";
  if (
    e.changeRequest?.status === "pending" ||
    e.status === "client_changes"
  ) {
    return "client_changes";
  }
  if (e.approvedAt || e.status === "proposed") return "proposed";
  if (e.status === "received") return "received";
  // Legacy: status held FeasibilityStatus — treat as still with the venue.
  return "received";
}

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

/**
 * Approved spec on an enquiry. `overrides` are keyed by LayoutItem.id or
 * groupId (e.g. "table-3") and applied after lib/layout.
 */
export type FinalSpec = Spec & {
  overrides?: Record<string, LayoutOverride>;
};

/** Placed item from lib/layout. Metres, y rotation in radians. Origin = room centre, north = −z. */
export type LayoutItem = {
  /** Stable for a given spec + room, e.g. "stage", "table-3", "table-3-chair-0". */
  id: string;
  kind: LayoutKind;
  x: number;
  z: number;
  rotY: number;
  /** Shared by a table and its chairs / seated guests (e.g. "table-3"). */
  groupId?: string;
};
