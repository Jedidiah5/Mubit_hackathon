import { diffSpec, pickCorrections, similarity, tokens } from "./corrections";
import { eventCues } from "./cues";
import { enquiryText, missingDetails, needsInfo } from "./missing";
import { trimEnquiry } from "./parse";
import type { Correction, FixedBy, Spec, SpecChange } from "./types";

/**
 * "Teach once, fixes everywhere": after a corrected enquiry is approved, the
 * waiting enquiries with the same cue are parsed again so they pick up the fix
 * as a note. Pure selection here; app/api/ripple does the calls.
 */

/** Re-parses per approval. Each one is a Mubit call (~3s). */
export const MAX_TARGETS = 5;

/** An access fix spreads to emails that mention access, whatever the event. */
const ACCESS_CUE =
  /\b(?:wheelchairs?|walkers?|walking (?:frame|stick)|crutches|mobility|step[-\s]?free|steady on)\b/i;

/**
 * Only when the corrected email names no event we know: near-duplicates only.
 * In data/inbox*.json same-kind pairs score 0.3–0.47, but so can unrelated
 * ones with the same boilerplate (awards dinner vs dinner dance: 0.37).
 */
export const FALLBACK_SIMILARITY = 0.5;

export type RippleCandidate = {
  id: string;
  subject: string;
  body: string;
  parsed?: Spec;
  final?: Spec;
  approvedAt?: string | null;
  roomOverride?: string | null;
};

export type RippleTarget = { id: string; score: number };

/** POST /api/ripple → one entry per enquiry the re-parse changed. */
export type RippleFix = { id: string; subject: string; changes: SpecChange[] };

export type RippleResponse = {
  targets: { id: string; subject: string }[];
  checked: number;
  fixed: RippleFix[];
  failed: number;
};

/** Corrected fields worth spreading: guest counts belong to one event. */
export function rippleFields(c: Correction): SpecChange[] {
  return c.changes.filter((ch) => ch.field !== "guests");
}

/**
 * Cues the fix is about: the event kind (subject + body, see lib/cues.ts),
 * plus access if access was fixed.
 */
function cuesOf(text: string, fields: SpecChange[]): Set<string> {
  const cues = fields.some((ch) => ch.field !== "accessible")
    ? eventCues(text)
    : new Set<string>();
  if (fields.some((ch) => ch.field === "accessible") && ACCESS_CUE.test(text)) {
    cues.add("access");
  }
  return cues;
}

/** Parsed, not approved, not touched by a person: a re-parse loses nothing. */
function waiting(e: RippleCandidate): boolean {
  if (!e.parsed || !e.final || e.approvedAt || e.roomOverride) return false;
  return diffSpec(e.parsed, e.final).length === 0;
}

/**
 * Waiting enquiries that share the corrected email's cue, most similar first,
 * at most MAX_TARGETS. Skips any that wouldn't get this correction as a note
 * (pickCorrections keeps the closest few), since their re-parse can't change.
 */
export function pickRippleTargets(
  correction: Correction,
  candidates: RippleCandidate[],
  corrections: Correction[],
  sourceSubject = "",
): RippleTarget[] {
  const fields = rippleFields(correction);
  if (fields.length === 0) return [];
  if (needsInfo(missingDetails(correction.email))) return [];

  const sourceCues = cuesOf(`${sourceSubject}\n${correction.email}`, fields);
  const source = tokens(correction.email);
  const pool = corrections.some((c) => c.enquiryId === correction.enquiryId)
    ? corrections
    : [correction, ...corrections];

  return candidates
    .filter((e) => e.id !== correction.enquiryId && waiting(e))
    .filter((e) => !needsInfo(missingDetails(enquiryText(e))))
    .map((e) => {
      const email = trimEnquiry(e.body);
      const score = similarity(source, tokens(email));
      const cues = cuesOf(enquiryText(e), fields);
      const sameCue =
        sourceCues.size > 0
          ? [...cues].some((c) => sourceCues.has(c))
          : score >= FALLBACK_SIMILARITY;
      return { id: e.id, email, score, sameCue };
    })
    .filter((t) => t.sameCue)
    .filter((t) =>
      pickCorrections(pool, t.email, t.id).some(
        (c) => c.enquiryId === correction.enquiryId,
      ),
    )
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_TARGETS)
    .map(({ id, score }) => ({ id, score }));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join();
  }
  return a === b;
}

/**
 * Corrected fields where the re-parse moved the way the coordinator did:
 * same value for style/stage/bar/accessible; for extras, an item they added
 * now appears (or one they removed is gone). Banquet → theatre after a
 * banquet → cabaret fix is not "fixed by your correction".
 */
export function rippleChanges(
  correction: Correction,
  before: Spec,
  after: Spec,
): SpecChange[] {
  const out: SpecChange[] = [];
  for (const ch of rippleFields(correction)) {
    const from = before[ch.field];
    const to = after[ch.field];
    if (sameValue(from, to)) continue;
    if (ch.field === "extras") {
      const fixFrom = ch.from as string[];
      const fixTo = ch.to as string[];
      const was = from as string[];
      const now = to as string[];
      const added = fixTo.filter((x) => !fixFrom.includes(x));
      const removed = fixFrom.filter((x) => !fixTo.includes(x));
      const followed =
        added.some((x) => now.includes(x) && !was.includes(x)) ||
        removed.some((x) => was.includes(x) && !now.includes(x));
      if (!followed) continue;
    } else if (to !== ch.to) {
      continue;
    }
    out.push({ field: ch.field, from, to } as SpecChange);
  }
  return out;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ").replace(/_/g, " ") : "none";
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** `style banquet → cabaret` */
export function describeChange(ch: SpecChange): string {
  return `${ch.field} ${formatValue(ch.from)} → ${formatValue(ch.to)}`;
}

/**
 * The "fixed by your correction" tag only means something until a person
 * takes over: hidden once the draft is approved or edited.
 */
export function showFixedBy(e: {
  fixedBy?: FixedBy | null;
  parsed?: Spec;
  final?: Spec;
  approvedAt?: string | null;
}): e is { fixedBy: FixedBy; parsed?: Spec; final?: Spec } {
  if (!e.fixedBy?.changes?.length || e.approvedAt) return false;
  return !e.parsed || !e.final || diffSpec(e.parsed, e.final).length === 0;
}
