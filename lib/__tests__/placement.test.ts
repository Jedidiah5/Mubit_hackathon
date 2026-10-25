import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_ROOMS } from "../data/venue";
import { applyOverrides } from "../layout/applyOverrides";
import {
  TABLE_GROUP_SIZE,
  footprintBounds,
  footprintSize,
  orientedSize,
} from "../layout/footprint";
import { layout } from "../layout";
import { placementProblem } from "../layout/placement";
import type { LayoutItem, LayoutOverride, Spec } from "../types";

const thames = DEMO_ROOMS[0]!;

const banquetSpec = (over: Partial<Spec> = {}): Spec => ({
  style: "banquet",
  guests: 40,
  stage: "north",
  bar: "east",
  extras: ["dance_floor", "dj_booth", "photo_booth"],
  accessible: true,
  ...over,
});

describe("layout item ids", () => {
  it("assigns stable role ids and table groupIds for the same spec + room", () => {
    const a = layout(thames, banquetSpec());
    const b = layout(thames, banquetSpec());
    assert.deepEqual(
      a.map((i) => ({ id: i.id, groupId: i.groupId, kind: i.kind })),
      b.map((i) => ({ id: i.id, groupId: i.groupId, kind: i.kind })),
    );
    assert.ok(a.some((i) => i.id === "stage"));
    assert.ok(a.some((i) => i.id === "bar"));
    assert.ok(a.some((i) => i.id === "dance_floor"));
    assert.ok(a.some((i) => i.id === "dj_booth"));
    assert.ok(a.some((i) => i.id === "photo_booth"));

    const table = a.find((i) => i.id === "table-3");
    assert.ok(table);
    assert.equal(table!.kind, "table_round");
    assert.equal(table!.groupId, "table-3");
    const chairs = a.filter(
      (i) => i.groupId === "table-3" && i.kind === "chair",
    );
    assert.equal(chairs.length, 10);
    assert.ok(chairs.every((c) => c.id.startsWith("table-3-chair-")));
  });
});

describe("footprint", () => {
  it("uses the specified sizes and swaps w/d on 90° turns", () => {
    assert.deepEqual(footprintSize("stage"), { w: 8, d: 3 });
    assert.deepEqual(footprintSize("bar"), { w: 6, d: 1.2 });
    assert.deepEqual(footprintSize("dance_floor"), { w: 6, d: 6 });
    assert.deepEqual(footprintSize("dj_booth"), { w: 2, d: 1.5 });
    assert.deepEqual(footprintSize("photo_booth"), { w: 2, d: 2 });
    assert.deepEqual(TABLE_GROUP_SIZE, { w: 3.2, d: 3.2 });

    assert.deepEqual(orientedSize({ w: 8, d: 3 }, 0), { w: 8, d: 3 });
    assert.deepEqual(orientedSize({ w: 8, d: 3 }, Math.PI / 2), {
      w: 3,
      d: 8,
    });
    assert.deepEqual(orientedSize({ w: 8, d: 3 }, Math.PI), { w: 8, d: 3 });
    assert.deepEqual(orientedSize({ w: 8, d: 3 }, (3 * Math.PI) / 2), {
      w: 3,
      d: 8,
    });
  });
});

describe("applyOverrides", () => {
  it("is a no-op when overrides are empty", () => {
    const items = layout(thames, banquetSpec());
    assert.deepEqual(applyOverrides(items, undefined), items);
    assert.deepEqual(applyOverrides(items, {}), items);
  });

  it("moves a table group around the table centre", () => {
    const items = layout(thames, banquetSpec());
    const table = items.find((i) => i.id === "table-1")!;
    const before = items.filter((i) => i.groupId === "table-1");
    const dx = 1.5;
    const dz = -0.8;
    const dRot = Math.PI / 2;
    const override: LayoutOverride = {
      x: table.x + dx,
      z: table.z + dz,
      rotY: table.rotY + dRot,
    };
    const after = applyOverrides(items, { "table-1": override });
    const moved = after.filter((i) => i.groupId === "table-1");
    const movedTable = moved.find((i) => i.id === "table-1")!;
    assert.ok(Math.abs(movedTable.x - override.x) < 1e-9);
    assert.ok(Math.abs(movedTable.z - override.z) < 1e-9);
    assert.ok(Math.abs(movedTable.rotY - override.rotY) < 1e-9);

    // Relative chair offsets rotate with the table.
    for (let i = 0; i < before.length; i++) {
      const b = before[i]!;
      const a = moved.find((m) => m.id === b.id)!;
      const relBefore = { x: b.x - table.x, z: b.z - table.z };
      const cos = Math.cos(dRot);
      const sin = Math.sin(dRot);
      const expect = {
        x: table.x + dx + relBefore.x * cos + relBefore.z * sin,
        z: table.z + dz - relBefore.x * sin + relBefore.z * cos,
      };
      assert.ok(Math.abs(a.x - expect.x) < 1e-9, a.id);
      assert.ok(Math.abs(a.z - expect.z) < 1e-9, a.id);
      assert.ok(Math.abs(a.rotY - (b.rotY + dRot)) < 1e-9, a.id);
    }
  });

  it("moves a lone feature by id", () => {
    const items = layout(thames, banquetSpec());
    const bar = items.find((i) => i.id === "bar")!;
    const next = applyOverrides(items, {
      bar: { x: 0, z: 0, rotY: Math.PI / 2 },
    });
    const moved = next.find((i) => i.id === "bar")!;
    assert.equal(moved.x, 0);
    assert.equal(moved.z, 0);
    assert.equal(moved.rotY, Math.PI / 2);
    // Other items unchanged.
    const stage = next.find((i) => i.id === "stage")!;
    const stageBefore = items.find((i) => i.id === "stage")!;
    assert.equal(stage.x, stageBefore.x);
    assert.equal(stage.z, stageBefore.z);
    void bar;
  });
});

describe("placementProblem", () => {
  it("returns null when leaving a piece where it already is", () => {
    const items = layout(thames, banquetSpec({ accessible: false }));
    // Dance floor uses the same 6×6 placement footprint as auto-layout.
    const dance = items.find((i) => i.id === "dance_floor")!;
    assert.equal(
      placementProblem(
        "dance_floor",
        { x: dance.x, z: dance.z, rotY: dance.rotY },
        items,
        thames,
      ),
      null,
    );
  });

  it("flags outside when the footprint leaves the room", () => {
    const items = layout(thames, banquetSpec({ accessible: false }));
    assert.equal(
      placementProblem(
        "dance_floor",
        { x: 100, z: 0, rotY: 0 },
        items,
        thames,
      ),
      "outside",
    );
  });

  it("flags taken when overlapping another piece", () => {
    const items = layout(thames, banquetSpec({ accessible: false }));
    const dance = items.find((i) => i.id === "dance_floor")!;
    assert.equal(
      placementProblem(
        "table-1",
        { x: dance.x, z: dance.z, rotY: 0 },
        items,
        thames,
      ),
      "taken",
    );
  });

  it("flags blocks_exit when covering the south door clearance", () => {
    const items = layout(
      thames,
      banquetSpec({ accessible: false, extras: [] }),
    );
    const hz = thames.lengthM / 2;
    // Keep the 3.2×3.2 table group inside the room but overlapping the
    // 1.5 m door pad (z ∈ [hz − 1.5, hz]).
    assert.equal(
      placementProblem(
        "table-1",
        { x: 0, z: hz - 1.7, rotY: 0 },
        items,
        thames,
        false,
      ),
      "blocks_exit",
    );
  });

  it("flags blocks_exit on the accessible route when accessible", () => {
    const items = layout(
      thames,
      banquetSpec({
        accessible: true,
        stage: "north",
        bar: "east",
        extras: [],
      }),
    );
    // West wall lane of the step-free route (bar is east → lane on west).
    const hx = thames.widthM / 2;
    const laneX = -hx + 1.5 + 0.75;
    assert.equal(
      placementProblem(
        "table-1",
        { x: laneX, z: 0, rotY: 0 },
        items,
        thames,
        true,
      ),
      "blocks_exit",
    );
  });
});

describe("footprintBounds helper", () => {
  it("centres the rect on the item", () => {
    const it: LayoutItem = {
      id: "bar",
      kind: "bar",
      x: 2,
      z: -1,
      rotY: 0,
    };
    const b = footprintBounds(it.x, it.z, footprintSize("bar"), 0);
    assert.equal(b.minX, 2 - 3);
    assert.equal(b.maxX, 2 + 3);
    assert.equal(b.minZ, -1 - 0.6);
    assert.equal(b.maxZ, -1 + 0.6);
  });
});
