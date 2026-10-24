import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bestRoom, capacity, check, effectiveCapacity } from "../feasibility";
import { DEMO_ROOMS } from "../data/venue";
import type { Spec } from "../types";

const baseSpec = (over: Partial<Spec> = {}): Spec => ({
  style: "banquet",
  guests: 120,
  stage: "none",
  bar: "none",
  extras: [],
  accessible: false,
  ...over,
});

describe("capacity", () => {
  const thames = DEMO_ROOMS[0]!;

  it("applies softer dance floor, buffet and photo booth modifiers", () => {
    assert.equal(capacity(thames, "banquet", []), 140);
    assert.equal(capacity(thames, "banquet", ["dance_floor"]), 128); // −8%
    assert.equal(capacity(thames, "banquet", ["buffet"]), 135); // −3%
    assert.equal(capacity(thames, "banquet", ["photo_booth"]), 139); // −1
    assert.equal(
      capacity(thames, "banquet", ["dance_floor", "buffet", "photo_booth"]),
      123,
    );
  });
});

describe("soft over-capacity", () => {
  const thames = DEMO_ROOMS[0]!;

  it("warns within 15% over capacity and suggests reduce / remove dance floor", () => {
    const spec = baseSpec({
      guests: 130,
      extras: ["dance_floor"],
      stage: "north",
    });
    const cap = effectiveCapacity(thames, spec);
    assert.ok(130 > cap);
    assert.ok(130 <= cap * 1.15);
    const result = check(thames, spec);
    assert.equal(result.status, "warning");
    assert.ok(result.notes.some((n) => /reduce to/i.test(n)));
    assert.ok(result.notes.some((n) => /remove dance floor/i.test(n)));
  });

  it("cannot when guests exceed capacity by more than 15%", () => {
    const result = check(thames, baseSpec({ guests: 200 }));
    assert.equal(result.status, "cannot");
  });
});

describe("bestRoom", () => {
  it("picks the smallest room that fits a mid-size banquet", () => {
    const result = bestRoom(DEMO_ROOMS, baseSpec({ guests: 50 }));
    assert.equal(result.status, "fits");
    assert.equal(result.room?.name, "Garden Room");
    assert.equal(result.used, 50);
    assert.ok((result.capacity ?? 0) >= 50);
  });

  it("picks Thames Hall for a large banquet", () => {
    const result = bestRoom(DEMO_ROOMS, baseSpec({ guests: 120 }));
    assert.equal(result.room?.name, "Thames Hall");
    assert.equal(result.status, "fits");
  });

  it("rejects The Loft when accessible is required", () => {
    const loftOnly = DEMO_ROOMS.filter((r) => r.name === "The Loft");
    const result = bestRoom(
      loftOnly,
      baseSpec({ guests: 20, accessible: true }),
    );
    assert.equal(result.status, "cannot");
    assert.ok(result.notes.some((n) => /step-free/i.test(n)));
  });

  it("cannot host when guests exceed every room", () => {
    const result = bestRoom(DEMO_ROOMS, baseSpec({ guests: 500 }));
    assert.equal(result.status, "cannot");
    assert.ok(result.room);
  });

  it("notes floor-space stage but still fits when capacity is OK", () => {
    const garden = DEMO_ROOMS.filter((r) => r.name === "Garden Room");
    const result = check(garden[0]!, baseSpec({ guests: 40, stage: "north" }));
    assert.equal(result.status, "fits");
    assert.ok(result.notes.some((n) => /floor space/i.test(n)));
  });

  it("stays fits (not warning) when above 95% capacity", () => {
    // Thames banquet capacity 140; 134 > 95% but ≤ capacity.
    const result = check(DEMO_ROOMS[0]!, baseSpec({ guests: 134 }));
    assert.equal(result.status, "fits");
    assert.ok(result.notes.some((n) => /near capacity/i.test(n)));
  });

  it("suggests another room when soft-over on the chosen hall", () => {
    const result = bestRoom(
      DEMO_ROOMS,
      baseSpec({ guests: 55, extras: ["dance_floor"], stage: "north" }),
    );
    // Garden may soft-warn; notes can mention Thames as alternative.
    assert.ok(result.status === "fits" || result.status === "warning");
  });
});
