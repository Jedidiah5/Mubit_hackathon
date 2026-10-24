import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bestRoom, capacity, check } from "../feasibility";
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

  it("applies dance floor, buffet and photo booth modifiers", () => {
    assert.equal(capacity(thames, "banquet", []), 140);
    assert.equal(capacity(thames, "banquet", ["dance_floor"]), 126);
    assert.equal(capacity(thames, "banquet", ["buffet"]), 133);
    assert.equal(capacity(thames, "banquet", ["photo_booth"]), 138);
    assert.equal(
      capacity(thames, "banquet", ["dance_floor", "buffet", "photo_booth"]),
      117,
    );
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
    const result = bestRoom(loftOnly, baseSpec({ guests: 20, accessible: true }));
    assert.equal(result.status, "cannot");
    assert.ok(result.notes.some((n) => /step-free/i.test(n)));
  });

  it("cannot host when guests exceed every room", () => {
    const result = bestRoom(DEMO_ROOMS, baseSpec({ guests: 500 }));
    assert.equal(result.status, "cannot");
    assert.ok(result.room);
  });

  it("warns when a stage needs floor space in Garden Room", () => {
    const garden = DEMO_ROOMS.filter((r) => r.name === "Garden Room");
    const result = check(garden[0]!, baseSpec({ guests: 40, stage: "north" }));
    assert.equal(result.status, "warning");
    assert.ok(result.notes.some((n) => /floor space/i.test(n)));
  });
});
