import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { diffSpec } from "../corrections";
import { trimEnquiry } from "../parse";
import {
  MAX_TARGETS,
  pickRippleTargets,
  rippleChanges,
  type RippleCandidate,
} from "../ripple";
import type { Correction, Spec } from "../types";

const banquet: Spec = {
  style: "banquet",
  guests: 90,
  stage: "none",
  bar: "east",
  extras: [],
  accessible: false,
};
const cabaret: Spec = {
  ...banquet,
  style: "cabaret",
  stage: "north",
  extras: ["lectern"],
};

function correction(
  enquiryId: string,
  body: string,
  parsed: Spec,
  final: Spec,
  at = "2026-10-25T01:00:00.000Z",
): Correction {
  return {
    enquiryId,
    requestId: "",
    email: trimEnquiry(body),
    parsed,
    final,
    changes: diffSpec(parsed, final),
    at,
  };
}

type Row = { id: string; subject: string; body: string };

function load(file: string): Row[] {
  return JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../../data", file), "utf8"),
  ) as Row[];
}

/** Every seeded email, parsed as banquet and untouched. */
const inbox: RippleCandidate[] = [
  "inbox.json",
  "inbox-batch2.json",
  "inbox-batch3.json",
  "inbox-ripple.json",
].flatMap((f) =>
  load(f).map((r) => ({ ...r, parsed: banquet, final: banquet })),
);

const golf = inbox.find((r) => r.id === "rp-awards-golf-90")!;
const golfFix = correction(golf.id, golf.body, banquet, cabaret);

describe("pickRippleTargets", () => {
  it("picks awards / trophy nights, not dinner dances, galas or weddings", () => {
    const ids = pickRippleTargets(golfFix, inbox, [golfFix], golf.subject).map(
      (t) => t.id,
    );
    assert.equal(ids.length, MAX_TARGETS);
    for (const id of ids) assert.doesNotMatch(id, /dance|gala|wedding/);
    assert.ok(!ids.includes(golf.id));
  });

  it("covers the demo batch when it's the only thing waiting", () => {
    const demo = inbox.filter((r) => r.id.startsWith("rp-"));
    const ids = pickRippleTargets(golfFix, demo, [golfFix], golf.subject)
      .map((t) => t.id)
      .sort();
    assert.deepEqual(ids, [
      "rp-awards-bowls-60",
      "rp-awards-darts-70",
      "rp-awards-staff-150",
      "rp-awards-swim-80",
    ]);
  });

  it("skips approved, hand-edited, room-overridden and unparsed enquiries", () => {
    const awards = inbox.filter((r) => /^rp-awards-(darts|staff|bowls|swim)/.test(r.id));
    const [a, b, c, d] = awards;
    const rows: RippleCandidate[] = [
      { ...a!, approvedAt: "2026-10-25T01:20:00.000Z" },
      { ...b!, final: cabaret },
      { ...c!, roomOverride: "Main Hall" },
      { ...d!, parsed: undefined, final: undefined },
    ];
    assert.deepEqual(pickRippleTargets(golfFix, rows, [golfFix]), []);
  });

  it("skips vague emails (no guest count or format)", () => {
    const vague: RippleCandidate = {
      id: "vague",
      subject: "Awards",
      body: "Hi, we'd love to hold our awards at your venue soon.",
      parsed: banquet,
      final: banquet,
    };
    assert.deepEqual(pickRippleTargets(golfFix, [vague], [golfFix]), []);
  });

  it("does nothing for a guests-only correction", () => {
    const fix = correction(golf.id, golf.body, banquet, { ...banquet, guests: 95 });
    assert.deepEqual(pickRippleTargets(fix, inbox, [fix]), []);
  });

  it("skips targets that other corrections would crowd out of the notes", () => {
    const darts = inbox.find((r) => r.id === "rp-awards-darts-70")!;
    // Six older corrections on the darts email itself rank above golf's.
    const crowd = Array.from({ length: 6 }, (_, i) =>
      correction(`dup${i}`, darts.body, banquet, cabaret, "2026-10-24T00:00:00.000Z"),
    );
    const ids = pickRippleTargets(golfFix, [darts], [golfFix, ...crowd]).map(
      (t) => t.id,
    );
    assert.deepEqual(ids, []);
  });

  it("spreads an access fix to emails that mention access", () => {
    const agm = inbox.find((r) => r.id === "b3-agm-65")!;
    const fix = correction(agm.id, agm.body, banquet, {
      ...banquet,
      accessible: true,
    });
    const ids = pickRippleTargets(fix, inbox, [fix], agm.subject).map((t) => t.id);
    assert.ok(ids.length > 0);
    for (const id of ids) {
      const row = inbox.find((r) => r.id === id)!;
      assert.match(
        row.body,
        /wheelchair|walker|walking|crutches|mobility|step-free|steady/i,
      );
    }
  });
});

describe("rippleChanges", () => {
  it("reports corrected fields that moved to the coordinator's value", () => {
    const after = { ...banquet, style: "cabaret" as const, extras: ["lectern" as const] };
    assert.deepEqual(rippleChanges(golfFix, banquet, after), [
      { field: "style", from: "banquet", to: "cabaret" },
      { field: "extras", from: [], to: ["lectern"] },
    ]);
  });

  it("ignores moves the other way and fields nobody corrected", () => {
    const after = { ...banquet, style: "theatre" as const, bar: "west" as const };
    assert.deepEqual(rippleChanges(golfFix, banquet, after), []);
  });

  it("ignores an unchanged re-parse", () => {
    assert.deepEqual(rippleChanges(golfFix, cabaret, cabaret), []);
  });
});
