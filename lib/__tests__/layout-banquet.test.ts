import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_ROOMS } from "../data/venue";
import { layoutBanquet } from "../layout/banquet";
import { CHAIRS_PER_ROUND } from "../layout/shared";
import type { Spec } from "../types";

const thames = DEMO_ROOMS[0]!;

const banquetSpec = (guests: number, over: Partial<Spec> = {}): Spec => ({
  style: "banquet",
  guests,
  stage: "north",
  bar: "east",
  extras: ["dance_floor"],
  accessible: true,
  ...over,
});

function count(
  items: { kind: string }[],
  kind: string,
): number {
  return items.filter((i) => i.kind === kind).length;
}

describe("layoutBanquet", () => {
  it("places 12 tables, 120 chairs and 120 seated guests for 120 covers", () => {
    const items = layoutBanquet(
      thames,
      banquetSpec(120, {
        stage: "none",
        bar: "none",
        extras: [],
        accessible: false,
      }),
    );
    assert.equal(count(items, "table_round"), 12);
    assert.equal(count(items, "chair"), 12 * CHAIRS_PER_ROUND);
    assert.equal(count(items, "guest_seated"), 120);
    assert.equal(count(items, "guest_overflow"), 0);
  });

  it("places stage, bar and dance floor from the spec", () => {
    const items = layoutBanquet(thames, banquetSpec(80));
    assert.ok(count(items, "stage") >= 1);
    assert.ok(count(items, "bar") >= 1);
    assert.ok(count(items, "dance_floor") >= 1);
  });

  it("caps seated guests at capacity and spills overflow by the door", () => {
    const items = layoutBanquet(thames, banquetSpec(160));
    const seated = count(items, "guest_seated");
    const overflow = count(items, "guest_overflow");
    assert.ok(seated <= 140);
    assert.equal(seated + overflow, 160);
    assert.ok(overflow > 0);
    // Overflow stands near the south wall (+z).
    const sample = items.find((i) => i.kind === "guest_overflow");
    assert.ok(sample);
    assert.ok(sample!.z > 0);
  });

  it("keeps chairs evenly around each table", () => {
    const items = layoutBanquet(thames, banquetSpec(10, { extras: [], stage: "none", bar: "none", accessible: false }));
    const tables = items.filter((i) => i.kind === "table_round");
    assert.equal(tables.length, 1);
    const chairs = items.filter((i) => i.kind === "chair");
    assert.equal(chairs.length, 10);
    const table = tables[0]!;
    for (const chair of chairs) {
      const dist = Math.hypot(chair.x - table.x, chair.z - table.z);
      assert.ok(dist > 1.2 && dist < 1.6);
    }
  });
});
