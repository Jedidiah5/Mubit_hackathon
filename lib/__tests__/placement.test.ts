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
import { effectiveCapacity } from "../feasibility";
import { layout } from "../layout";
import {
  movableAnchors,
  pickAt,
  pickId,
  pieceLabel,
} from "../layout/movable";
import { placementProblem } from "../layout/placement";
import {
  ROUND_TABLE_CLEARANCE_M,
  southDoorPad,
  stageWidth,
} from "../layout/shared";
import type { LayoutItem, LayoutOverride, Spec, Wall } from "../types";

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
  it("uses the auto-layout sizes and swaps w/d on 90° turns", () => {
    assert.deepEqual(footprintSize("bar"), { w: 3.5, d: 1.2 });
    assert.deepEqual(footprintSize("dance_floor"), { w: 6, d: 6 });
    assert.deepEqual(footprintSize("dj_booth"), { w: 1.6, d: 1.6 });
    assert.deepEqual(footprintSize("photo_booth"), { w: 1.6, d: 1.6 });
    assert.deepEqual(TABLE_GROUP_SIZE, { w: 3.2, d: 3.2 });
    // Stage width follows the room and the wall it backs onto, as drawn.
    assert.deepEqual(footprintSize("stage", thames, 0), {
      w: stageWidth(thames, "north"),
      d: 2.4,
    });
    assert.deepEqual(footprintSize("stage", thames, -Math.PI / 2), {
      w: stageWidth(thames, "east"),
      d: 2.4,
    });

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

  it("does not treat hidden standing guests as occupied floor", () => {
    const all = layout(thames, {
      style: "reception",
      guests: 40,
      stage: "none",
      bar: "none",
      extras: [],
      accessible: false,
    });
    // Keep one high table plus the guests, so only guests could block it.
    const items = all.filter(
      (it) =>
        it.kind === "guest_standing" ||
        it.id === "table-1" ||
        it.groupId === "table-1",
    );
    const guest = items.find(
      (it) =>
        it.kind === "guest_standing" && Math.abs(it.x) < 6 && Math.abs(it.z) < 4,
    );
    assert.ok(guest);
    assert.equal(
      placementProblem(
        "table-1",
        { x: guest.x, z: guest.z, rotY: 0 },
        items,
        thames,
      ),
      null,
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

/**
 * Auto-layout stacks some features on one wall: the photo booth always goes
 * east, and with no stage the DJ booth shares the bar's or buffet's wall and
 * the lectern takes the north wall. Those overlaps are real (drawn on top of
 * each other), so they stay out.
 */
function stacksOnOneWall(spec: Spec): boolean {
  const east = spec.stage === "east" || spec.bar === "east";
  if (spec.extras.includes("photo_booth") && east) return true;
  if (spec.extras.includes("dj_booth") && spec.stage === "none") return true;
  if (
    spec.extras.includes("lectern") &&
    spec.stage === "none" &&
    spec.bar === "north"
  ) {
    return true;
  }
  return false;
}

describe("placementProblem agrees with auto-layout", () => {
  it("passes Jo Patel's speed-dating table by the south door where it stands", () => {
    const spec: Spec = {
      style: "cabaret",
      guests: 50,
      stage: "none",
      bar: "east",
      extras: [],
      accessible: false,
    };
    const items = layout(thames, spec);
    for (const a of movableAnchors(items)) {
      assert.equal(
        placementProblem(
          pickId(a),
          { x: a.x, z: a.z, rotY: a.rotY },
          items,
          thames,
          false,
        ),
        null,
        pickId(a),
      );
    }
  });

  it("leaves every Thames Hall piece valid where auto-layout put it", () => {
    const styles = ["banquet", "cabaret", "theatre", "reception"] as const;
    // A stage on the south wall covers the door wherever it goes.
    const stages: Wall[] = ["none", "north", "east", "west"];
    const bars: Wall[] = ["none", "north", "south", "east", "west"];
    const extrasSets: Spec["extras"][] = [
      [],
      ["dance_floor"],
      ["dj_booth"],
      ["photo_booth"],
      ["buffet"],
      ["lectern", "projector"],
      ["dance_floor", "dj_booth", "photo_booth", "buffet", "lectern", "projector"],
    ];
    let checked = 0;
    for (const style of styles)
      for (const guests of [20, 40, 60, 80, 100, 140, 200])
        for (const stage of stages)
          for (const bar of bars)
            for (const extras of extrasSets) {
              if (bar !== "none" && bar === stage) continue;
              const spec: Spec = {
                style,
                guests,
                stage,
                bar,
                extras,
                accessible: false,
              };
              if (stacksOnOneWall(spec)) continue;
              if (guests > effectiveCapacity(thames, spec)) continue;
              const items = layout(thames, spec);
              for (const a of movableAnchors(items)) {
                checked += 1;
                const problem = placementProblem(
                  pickId(a),
                  { x: a.x, z: a.z, rotY: a.rotY },
                  items,
                  thames,
                  false,
                );
                assert.equal(
                  problem,
                  null,
                  `${pickId(a)} in ${JSON.stringify(spec)}`,
                );
              }
            }
    assert.ok(checked > 1000);
  });

  it("keeps tables and a south-wall bar off the south door pad", () => {
    for (const room of DEMO_ROOMS) {
      const roomPad = southDoorPad(room);
      for (const style of ["banquet", "cabaret"] as const) {
        const spec: Spec = {
          style,
          guests: 40,
          stage: "north",
          bar: "south",
          extras: [],
          accessible: false,
        };
        const items = layout(room, spec);
        for (const t of items.filter((i) => i.kind === "table_round")) {
          const r = ROUND_TABLE_CLEARANCE_M;
          const overlaps =
            t.x - r < roomPad.maxX &&
            t.x + r > roomPad.minX &&
            t.z - r < roomPad.maxZ &&
            t.z + r > roomPad.minZ;
          assert.equal(overlaps, false, `${room.name} ${t.id}`);
        }
        const bar = items.find((i) => i.kind === "bar")!;
        const b = footprintBounds(bar.x, bar.z, footprintSize("bar"), bar.rotY);
        assert.ok(
          b.maxX <= roomPad.minX || b.minX >= roomPad.maxX,
          `${room.name} bar covers the door`,
        );
      }
    }
  });
});

describe("pickAt", () => {
  const spec = banquetSpec({ accessible: false });
  const items = layout(thames, spec);
  const anchor = (id: string) =>
    movableAnchors(items).find((a) => pickId(a) === id)!;

  it("picks every movable piece at its own centre", () => {
    for (const a of movableAnchors(items)) {
      // The DJ booth stands on the stage; the stage is still pickable off it.
      if (a.kind === "stage") continue;
      assert.equal(pickAt(items, thames, a.x, a.z), pickId(a), pickId(a));
    }
  });

  it("prefers the smaller piece where two overlap", () => {
    const dj = anchor("dj_booth");
    assert.equal(pickAt(items, thames, dj.x, dj.z), "dj_booth");
    const stage = anchor("stage");
    assert.equal(pickAt(items, thames, stage.x + 3, stage.z), "stage");
  });

  it("only counts the table top in core mode", () => {
    const t = anchor("table-1");
    assert.equal(pickAt(items, thames, t.x + 1.3, t.z), "table-1");
    assert.equal(pickAt(items, thames, t.x + 1.3, t.z, { core: true }), null);
  });

  it("skips the selected piece", () => {
    const t = anchor("table-1");
    assert.notEqual(
      pickAt(items, thames, t.x, t.z, { skip: "table-1" }),
      "table-1",
    );
  });

  it("names pieces for the hover label", () => {
    assert.equal(pieceLabel(anchor("table-3")), "Table 3");
    assert.equal(pieceLabel(anchor("dance_floor")), "Dance floor");
  });
});

describe("stage moves", () => {
  it("carry the lectern and projector with the stage", () => {
    const items = layout(
      thames,
      banquetSpec({ extras: ["lectern", "projector"], accessible: false }),
    );
    const stage = items.find((i) => i.kind === "stage")!;
    const lectern = items.find((i) => i.kind === "lectern")!;
    const moved = applyOverrides(items, {
      stage: { x: stage.x + 2, z: stage.z, rotY: stage.rotY },
    });
    const movedLectern = moved.find((i) => i.kind === "lectern")!;
    assert.ok(Math.abs(movedLectern.x - (lectern.x + 2)) < 1e-9);
    assert.ok(Math.abs(movedLectern.z - lectern.z) < 1e-9);
  });
});

describe("adding and deleting pieces", () => {
  it("deletes a table with its chairs and guests", () => {
    const items = layout(thames, banquetSpec({ accessible: false }));
    const table = items.find((i) => i.id === "table-2")!;
    const next = applyOverrides(items, {
      "table-2": { x: table.x, z: table.z, rotY: 0, removed: true },
    });
    assert.equal(next.filter((i) => i.groupId === "table-2").length, 0);
    assert.ok(next.some((i) => i.groupId === "table-1"));
  });

  it("adds a sign at its pose with the key as id", () => {
    const items = layout(thames, banquetSpec({ accessible: false }));
    const next = applyOverrides(items, {
      "added-sign-1": { x: 1, z: 2, rotY: 0, kind: "sign" },
    });
    const sign = next.find((i) => i.id === "added-sign-1")!;
    assert.equal(sign.kind, "sign");
    assert.equal(sign.x, 1);
    assert.equal(pickId(sign), "added-sign-1");
  });

  it("checks a piece being added by its kind", () => {
    const items = layout(thames, banquetSpec({ accessible: false }));
    const t = items.find((i) => i.id === "table-1")!;
    assert.equal(
      placementProblem("added-tv-1", { x: t.x, z: t.z, rotY: 0 }, items, thames, false, "tv"),
      "taken",
    );
    assert.equal(
      placementProblem("added-tv-1", { x: 100, z: 0, rotY: 0 }, items, thames, false, "tv"),
      "outside",
    );
  });

  it("moves standing guests out of furniture placed on them", () => {
    const spec: Spec = {
      style: "reception",
      guests: 80,
      stage: "none",
      bar: "none",
      extras: [],
      accessible: false,
    };
    const items = layout(thames, spec);
    const guest = items.find((i) => i.kind === "guest_standing")!;
    const next = applyOverrides(
      items,
      { "added-tv-1": { x: guest.x, z: guest.z, rotY: 0, kind: "tv" } },
      thames,
    );
    const moved = next.find((i) => i.id === guest.id)!;
    const tv = footprintBounds(guest.x, guest.z, footprintSize("tv"), 0);
    const stillInside =
      moved.x > tv.minX && moved.x < tv.maxX && moved.z > tv.minZ && moved.z < tv.maxZ;
    assert.equal(stillInside, false);
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
    assert.equal(b.minX, 2 - 1.75);
    assert.equal(b.maxX, 2 + 1.75);
    assert.equal(b.minZ, -1 - 0.6);
    assert.equal(b.maxZ, -1 + 0.6);
  });
});
