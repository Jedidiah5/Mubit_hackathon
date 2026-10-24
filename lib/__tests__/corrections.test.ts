import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_NOTES,
  buildUserMessage,
  diffSpec,
  formatNote,
  isCorrection,
  pickCorrections,
} from "../corrections";
import { trimEnquiry } from "../parse";
import type { Correction, Spec } from "../types";

const base: Spec = {
  style: "theatre",
  guests: 65,
  stage: "north",
  bar: "none",
  extras: ["lectern", "projector"],
  accessible: false,
};

function correction(
  enquiryId: string,
  email: string,
  final: Partial<Spec>,
  at = "2026-10-24T10:00:00.000Z",
): Correction {
  const next = { ...base, ...final };
  return {
    enquiryId,
    requestId: "",
    email,
    parsed: base,
    final: next,
    changes: diffSpec(base, next),
    at,
  };
}

describe("trimEnquiry", () => {
  it("keeps indirect clues that match no keyword", () => {
    const text =
      "Hello, we're holding our annual shareholders meeting in March, roughly 60 to 70 attendees. Our chair will present the accounts on slides. Two of our members use walkers. Thanks, Claude";
    assert.match(trimEnquiry(text), /walkers/);
  });

  it("still drops greetings and sign-offs", () => {
    const out = trimEnquiry("Hi,\n\nDinner for 40.\n\nKind regards,\nSam");
    assert.equal(out, "Dinner for 40.");
  });
});

describe("diffSpec", () => {
  it("lists only changed fields and ignores extras order", () => {
    const changes = diffSpec(base, {
      ...base,
      accessible: true,
      extras: ["projector", "lectern"],
    });
    assert.deepEqual(changes, [{ field: "accessible", from: false, to: true }]);
  });
});

describe("pickCorrections", () => {
  const agm = correction(
    "agm",
    "Annual shareholders meeting, 60 attendees, members use walkers",
    { accessible: true },
  );
  const awards = correction("awards", "Staff awards dinner for 90", {
    style: "cabaret",
  });
  const guestsOnly = correction("g", "Shareholders meeting for 40", {
    guests: 40,
  });

  it("ranks the most similar email first", () => {
    const picked = pickCorrections(
      [awards, agm],
      "Shareholders meeting next spring, about 80 members",
    );
    assert.equal(picked[0]?.enquiryId, "agm");
  });

  it("skips the enquiry itself and guest-only corrections", () => {
    const picked = pickCorrections([agm, guestsOnly], "shareholders", "agm");
    assert.deepEqual(picked, []);
  });

  it(`returns at most ${MAX_NOTES}`, () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      correction(`c${i}`, `awards night ${i}`, { style: "cabaret" }),
    );
    assert.equal(pickCorrections(many, "awards night").length, MAX_NOTES);
  });
});

describe("buildUserMessage", () => {
  it("is just the email when there are no notes", () => {
    assert.equal(buildUserMessage("Dinner for 40.", []), "Dinner for 40.");
  });

  it("puts notes above the email and never mentions guest counts", () => {
    const c = correction("x", "Awards night for 90", {
      style: "cabaret",
      guests: 95,
    });
    const msg = buildUserMessage("Awards evening for 150.", [c]);
    assert.match(msg, /→ style: cabaret$/m);
    assert.doesNotMatch(formatNote(c), /guests/);
    assert.ok(msg.endsWith("Enquiry:\nAwards evening for 150."));
  });
});

describe("isCorrection", () => {
  it("rejects legacy per-keystroke rows", () => {
    assert.equal(
      isCorrection({ enquiryId: "a", field: "guests", from: 10, to: 100 }),
      false,
    );
  });
});
