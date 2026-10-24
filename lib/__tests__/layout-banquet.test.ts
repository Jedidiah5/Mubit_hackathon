import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_ROOMS } from "../data/venue";
import { effectiveCapacity } from "../feasibility";
import { layoutBanquet } from "../layout/banquet";
import {
  CHAIRS_PER_ROUND,
  DANCE_SIZE_M,
  blockedRects,
  isBlocked,
} from "../layout/shared";
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

function count(items: { kind: string }[], kind: string): number {
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

  it("seats everyone capacity allows even with dance floor / stage / bar", () => {
    const spec = banquetSpec(120);
    const cap = effectiveCapacity(thames, spec);
    const seatedTarget = Math.min(120, cap);
    const tablesNeeded = Math.ceil(seatedTarget / CHAIRS_PER_ROUND);
    const items = layoutBanquet(thames, spec);
    assert.equal(count(items, "table_round"), tablesNeeded);
    assert.equal(count(items, "guest_seated"), seatedTarget);
    assert.equal(count(items, "guest_overflow"), Math.max(0, 120 - cap));
  });

  it("places stage, bar and dance floor from the spec", () => {
    const items = layoutBanquet(thames, banquetSpec(80));
    assert.ok(count(items, "stage") >= 1);
    assert.ok(count(items, "bar") >= 1);
    assert.ok(count(items, "dance_floor") >= 1);
  });

  it("keeps tables off dance / stage / bar footprints", () => {
    const spec = banquetSpec(80);
    const blocks = blockedRects(thames, spec);
    const items = layoutBanquet(thames, spec);
    for (const t of items.filter((i) => i.kind === "table_round")) {
      assert.equal(isBlocked(t.x, t.z, 0.9, blocks), false);
    }
    const dance = items.find((i) => i.kind === "dance_floor");
    assert.ok(dance);
    for (const t of items.filter((i) => i.kind === "table_round")) {
      assert.ok(
        Math.abs(t.x - dance!.x) >= DANCE_SIZE_M / 2 - 0.01 ||
          Math.abs(t.z - dance!.z) >= DANCE_SIZE_M / 2 - 0.01,
      );
    }
  });

  it("caps seated guests at capacity and spills overflow by the south door", () => {
    const spec = banquetSpec(160);
    const cap = effectiveCapacity(thames, spec);
    const items = layoutBanquet(thames, spec);
    const seated = count(items, "guest_seated");
    const overflow = count(items, "guest_overflow");
    assert.equal(seated, Math.min(160, cap));
    assert.equal(overflow, Math.max(0, 160 - cap));
    assert.equal(seated + overflow, 160);
    assert.ok(overflow > 0);
    const sample = items.find((i) => i.kind === "guest_overflow");
    assert.ok(sample);
    assert.ok(sample!.z > 0);
    const blocks = blockedRects(thames, spec);
    for (const g of items.filter((i) => i.kind === "guest_overflow")) {
      assert.equal(isBlocked(g.x, g.z, 0.3, blocks), false);
    }
  });

  it("keeps chairs evenly around each table", () => {
    const items = layoutBanquet(
      thames,
      banquetSpec(10, {
        extras: [],
        stage: "none",
        bar: "none",
        accessible: false,
      }),
    );
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
