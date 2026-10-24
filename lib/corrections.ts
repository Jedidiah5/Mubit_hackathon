import type { Correction, Spec, SpecChange } from "./types";

/** Most notes put above one enquiry. Keeps training examples short. */
export const MAX_NOTES = 6;
/** Long enough to keep the cue behind a correction ("members use walkers"). */
const SNIPPET_CHARS = 300;

const SPEC_FIELDS = [
  "style",
  "guests",
  "stage",
  "bar",
  "extras",
  "accessible",
] as const satisfies readonly (keyof Spec)[];

/**
 * Guest counts belong to one event, not to the venue's habits, so they never
 * become notes (the model could copy the number).
 */
const NOTE_FIELDS = new Set<keyof Spec>(
  SPEC_FIELDS.filter((f) => f !== "guests"),
);

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join();
  }
  return a === b;
}

/** Fields the coordinator changed, model value → current value. */
export function diffSpec(parsed: Spec, final: Spec): SpecChange[] {
  const changes: SpecChange[] = [];
  for (const field of SPEC_FIELDS) {
    if (!sameValue(parsed[field], final[field])) {
      changes.push({ field, from: parsed[field], to: final[field] } as SpecChange);
    }
  }
  return changes;
}

/** True for docs in the current shape (older per-keystroke rows are skipped). */
export function isCorrection(value: unknown): value is Correction {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<Correction>;
  return (
    typeof c.enquiryId === "string" &&
    typeof c.email === "string" &&
    Array.isArray(c.changes)
  );
}

const STOPWORDS = new Set(
  "the and for with our you your are will about would like some have from that this into then just there their they them can could please also any but not all its it's was were been need want looking around".split(
    " ",
  ),
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.sqrt(a.size * b.size);
}

function noteChanges(c: Correction): SpecChange[] {
  return c.changes.filter((ch) => NOTE_FIELDS.has(ch.field));
}

/**
 * Up to MAX_NOTES corrections for this email: most similar first, then most
 * recent. Skips the enquiry itself and corrections that only changed guests.
 */
export function pickCorrections(
  all: Correction[],
  email: string,
  excludeEnquiryId?: string,
): Correction[] {
  const target = tokens(email);
  return all
    .filter((c) => c.enquiryId !== excludeEnquiryId)
    .filter((c) => noteChanges(c).length > 0)
    .map((c) => ({ c, score: similarity(target, tokens(c.email)) }))
    .sort((x, y) => y.score - x.score || y.c.at.localeCompare(x.c.at))
    .slice(0, MAX_NOTES)
    .map((x) => x.c);
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  return String(value);
}

function snippet(email: string): string {
  const flat = email.replace(/\s+/g, " ").trim();
  if (flat.length <= SNIPPET_CHARS) return flat;
  return `${flat.slice(0, SNIPPET_CHARS).replace(/\s+\S*$/, "")}…`;
}

/** `- "email…" → style: cabaret; accessible: true` */
export function formatNote(c: Correction): string {
  const fields = noteChanges(c)
    .map((ch) => `${ch.field}: ${formatValue(ch.to)}`)
    .join("; ");
  return `- "${snippet(c.email)}" → ${fields}`;
}

/** User message for the parse call. With no notes it is just the email. */
export function buildUserMessage(email: string, notes: Correction[]): string {
  if (notes.length === 0) return email;
  return [
    "Corrections this venue's coordinator made to earlier enquiries. Each shows the earlier email and the fields they changed. Apply a correction only if this enquiry has the same cue; otherwise ignore it.",
    ...notes.map(formatNote),
    "",
    "Enquiry:",
    email,
  ].join("\n");
}
