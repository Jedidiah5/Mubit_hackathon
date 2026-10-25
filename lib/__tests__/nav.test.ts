import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_ROOMS } from "../data/venue";
import { layout } from "../layout";
import {
  buildNavGrid,
  findPath,
  freeCells,
  isFree,
  nearestFree,
} from "../layout/nav";
import type { Point } from "../layout/shared";
import type { LayoutItem, Spec } from "../types";

const thames = DEMO_ROOMS[0]!;

const reception: Spec = {
  style: "reception",
  guests: 120,
  stage: "north",
  bar: "east",
  extras: ["dance_floor", "dj_booth"],
  accessible: false,
};

/** Every point along the route (sampled every 5 cm) is walkable. */
function routeIsClear(
  grid: ReturnType<typeof buildNavGrid>,
  from: Point,
  path: Point[],
): boolean {
  let a = from;
  for (const b of path) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!isFree(grid, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) {
        return false;
      }
    }
    a = b;
  }
  return true;
}

describe("nav grid", () => {
  it("blocks furniture and walls but not the dance floor", () => {
    const items = layout(thames, reception);
    const grid = buildNavGrid(items, thames);
    const bar = items.find((i) => i.kind === "bar")!;
    const dance = items.find((i) => i.kind === "dance_floor")!;
    assert.equal(isFree(grid, bar), false);
    assert.equal(isFree(grid, { x: thames.widthM / 2 - 0.1, z: 0 }), false);
    assert.equal(isFree(grid, dance), true);
  });

  it("routes around a table instead of through it", () => {
    const table: LayoutItem = {
      id: "table-1",
      kind: "table_round",
      x: 0,
      z: 0,
      rotY: 0,
      groupId: "table-1",
    };
    const grid = buildNavGrid([table], thames);
    const from = { x: -4, z: 0 };
    const to = { x: 4, z: 0 };
    const path = findPath(grid, from, to)!;
    assert.ok(path.length >= 2, "needs a detour");
    assert.ok(routeIsClear(grid, from, path));
    assert.deepEqual(path[path.length - 1], to);
  });

  it("finds clear routes between free spots in a busy reception", () => {
    const items = layout(thames, reception);
    const walkers = new Set(
      items.filter((i) => i.kind === "guest_standing").slice(0, 10).map((i) => i.id),
    );
    const grid = buildNavGrid(items, thames, { ignore: walkers });
    const cells = freeCells(grid);
    let routed = 0;
    for (let k = 0; k < 20; k++) {
      const from = cells[(k * 37) % cells.length]!;
      const to = cells[(k * 91 + 13) % cells.length]!;
      const path = findPath(grid, from, to);
      if (!path) continue;
      routed += 1;
      assert.ok(routeIsClear(grid, from, path), `route ${k}`);
    }
    assert.ok(routed >= 15);
  });

  it("steps a blocked point to the nearest free cell", () => {
    const items = layout(thames, reception);
    const grid = buildNavGrid(items, thames);
    const bar = items.find((i) => i.kind === "bar")!;
    const p = nearestFree(grid, bar)!;
    assert.ok(isFree(grid, p));
  });
});
