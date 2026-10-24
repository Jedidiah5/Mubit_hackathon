import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_ROOMS } from "../data/venue";
import { layout } from "../layout";
import { wallNormal } from "../layout/shared";
import type { LayoutItem, Spec, Wall } from "../types";

const thames = DEMO_ROOMS[0]!;
const WALLS: Wall[] = ["north", "south", "east", "west", "none"];

const spec = (style: Spec["style"], stage: Wall): Spec => ({
  style,
  guests: 110,
  stage,
  bar: "none",
  extras: [],
  accessible: false,
});

/** World direction local +z points to at this yaw (three.js convention). */
function facing(it: LayoutItem): { x: number; z: number } {
  return { x: Math.sin(it.rotY), z: Math.cos(it.rotY) };
}

function dot(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return a.x * b.x + a.z * b.z;
}

function unit(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z);
  return { x: x / len, z: z / len };
}

function ofKind(items: LayoutItem[], kind: LayoutItem["kind"]): LayoutItem[] {
  return items.filter((i) => i.kind === kind);
}

/** Every seated guest sits on a chair at the same spot, facing the same way. */
function assertOnChairs(items: LayoutItem[]) {
  const chairs = ofKind(items, "chair");
  for (const g of ofKind(items, "guest_seated")) {
    const chair = chairs.find(
      (c) => Math.abs(c.x - g.x) < 1e-9 && Math.abs(c.z - g.z) < 1e-9,
    );
    assert.ok(chair, `no chair under guest at ${g.x},${g.z}`);
    assert.ok(dot(facing(chair), facing(g)) > 0.999, "guest sits backwards");
  }
}

describe("seat facing", () => {
  for (const stage of WALLS) {
    // With no stage, theatre faces north (where a lectern / screen would go).
    const front = wallNormal(stage === "none" ? "north" : stage);

    it(`theatre faces the stage (${stage})`, () => {
      const items = layout(thames, spec("theatre", stage));
      const seats = [...ofKind(items, "chair"), ...ofKind(items, "guest_seated")];
      assert.ok(seats.length > 0);
      for (const s of seats) assert.ok(dot(facing(s), front) > 0.999);
      for (const st of ofKind(items, "stage")) {
        // Stage front (+z) looks back at the audience…
        assert.ok(dot(facing(st), front) < -0.999);
        // …and every seat has the stage in front of it.
        for (const s of seats) {
          assert.ok(dot(facing(s), unit(st.x - s.x, st.z - s.z)) > 0);
        }
      }
      assertOnChairs(items);
    });

    it(`cabaret leaves the stage side of each table open (${stage})`, () => {
      const items = layout(thames, spec("cabaret", stage));
      const tables = ofKind(items, "table_round");
      const seats = [...ofKind(items, "chair"), ...ofKind(items, "guest_seated")];
      assert.ok(tables.length > 0);
      for (const s of seats) {
        assert.ok(dot(facing(s), front) > 0.999);
        const t = tables.reduce((a, b) =>
          Math.hypot(b.x - s.x, b.z - s.z) < Math.hypot(a.x - s.x, a.z - s.z) ? b : a,
        );
        // Chairs sit on the far half; the half towards the stage is open.
        assert.ok(dot({ x: s.x - t.x, z: s.z - t.z }, front) < 1e-9);
      }
      assertOnChairs(items);
    });

    it(`banquet guests face their own table (${stage})`, () => {
      const items = layout(thames, spec("banquet", stage));
      const tables = ofKind(items, "table_round");
      const seats = [...ofKind(items, "chair"), ...ofKind(items, "guest_seated")];
      assert.ok(seats.length > 0);
      for (const s of seats) {
        const t = tables.reduce((a, b) =>
          Math.hypot(b.x - s.x, b.z - s.z) < Math.hypot(a.x - s.x, a.z - s.z) ? b : a,
        );
        assert.ok(dot(facing(s), unit(t.x - s.x, t.z - s.z)) > 0.999);
      }
      assertOnChairs(items);
    });

    it(`wall features face into the room (${stage})`, () => {
      if (stage === "none") return;
      const items = layout(thames, spec("reception", stage));
      const [st] = ofKind(items, "stage");
      assert.ok(st);
      assert.ok(dot(facing(st), wallNormal(stage)) < -0.999);
    });
  }
});
