import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_ROOMS } from "../data/venue";
import { formatGbp, quote } from "../quote";
import type { Spec } from "../types";

const thames = DEMO_ROOMS[0]!;

const base = (over: Partial<Spec> = {}): Spec => ({
  style: "banquet",
  guests: 80,
  stage: "north",
  bar: "east",
  extras: [],
  accessible: false,
  ...over,
});

describe("quote", () => {
  it("sums hire + per-head + extras, then adds 20% VAT", () => {
    // 1500 + 80×65 + dance 300 + projector 100 = 1500+5200+300+100 = 7100
    const q = quote(
      thames,
      base({ extras: ["dance_floor", "projector"] }),
    );
    assert.equal(q.belowMinSpend, false);
    assert.equal(q.minSpendTopUp, 0);
    assert.equal(q.subtotal, 7100);
    assert.equal(q.vat, 1420);
    assert.equal(q.total, 8520);
    assert.ok(q.lines.some((l) => l.label === "Room hire" && l.amount === 1500));
    assert.ok(q.lines.some((l) => /Banquet catering/.test(l.label) && l.amount === 5200));
    assert.ok(q.lines.some((l) => l.label === "Dance floor" && l.amount === 300));
    assert.ok(q.lines.some((l) => l.label === "Projector" && l.amount === 100));
    assert.equal(formatGbp(q.total), "£8,520.00");
  });

  it("adds a minimum-spend top-up when the subtotal is below the floor", () => {
    // Loft: hire 400 + 10×55 banquet = 950 < 1200 → top-up 250
    const loft = DEMO_ROOMS[2]!;
    const q = quote(loft, base({ style: "banquet", guests: 10, extras: [] }));
    assert.equal(q.belowMinSpend, true);
    assert.equal(q.minSpendTopUp, 250);
    assert.ok(
      q.lines.some(
        (l) => l.label === "Minimum spend top-up" && l.amount === 250,
      ),
    );
    assert.equal(q.subtotal, 1200);
    assert.equal(q.vat, 240);
    assert.equal(q.total, 1440);
  });
});
