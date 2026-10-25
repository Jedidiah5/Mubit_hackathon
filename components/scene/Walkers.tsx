"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  buildNavGrid,
  findPath,
  freeCells,
  nearestFree,
  type NavGrid,
} from "@/lib/layout/nav";
import { BAR_DEPTH_M, type Point } from "@/lib/layout/shared";
import type { LayoutItem, Room } from "@/lib/types";
import { BUILD_DURATION_S, popScale, unitNoise } from "./buildAnim";
import { seedFor } from "./instancing";
import { PEOPLE_MODELS, type LiveBody, type RiggedModel, liveBody } from "./bakePeople";
import { colourFor, lookFor } from "./People";

/** Walking pace (m/s), roughly what the Walk clip's stride covers. */
const SPEED_M_S = 0.9;
/** Personal space: a walker stops if someone is this close ahead. */
const NEAR_M = 0.7;
/** Waiting this long behind someone means pick somewhere else to go. */
const GIVE_WAY_S = 1.2;
/** Seconds spent chatting between walks. */
const CHAT_MIN_S = 3;
const CHAT_MAX_S = 9;
const FADE_S = 0.25;
/** At most this many guests walk at once; one in five standing guests. */
export const MAX_WALKERS = 24;

/** Standing guests who walk around (every fifth, capped), with their index for looks. */
export function pickWalkers(
  standing: LayoutItem[],
): { it: LayoutItem; i: number }[] {
  return standing
    .map((it, i) => ({ it, i }))
    .filter(({ i }) => i % 5 === 2)
    .slice(0, MAX_WALKERS);
}

type Mode = "chat" | "walk";

type Walker = {
  body: LiveBody;
  scale: number;
  seed: number;
  /** Draw counter for this walker's pseudo-random choices. */
  draws: number;
  x: number;
  z: number;
  heading: number;
  mode: Mode;
  path: Point[];
  /** Chat ends at this build-clock time. */
  until: number;
  waited: number;
};

/** Deterministic 0–1 draw, so the scene behaves the same every load. */
function draw(w: Walker): number {
  w.draws += 1;
  return unitNoise(w.seed * 131 + w.draws * 17);
}

/**
 * Places worth walking to: beside other guests (joining a conversation), in
 * front of the bar, on the dance floor, or anywhere free. All on free floor.
 */
function destinations(items: LayoutItem[], grid: NavGrid, walkerIds: Set<string>): Point[] {
  const out: Point[] = [];
  const add = (p: Point) => {
    const f = nearestFree(grid, p, 1.5);
    if (f) out.push(f);
  };
  items.forEach((it, k) => {
    if (it.kind === "guest_standing" && !walkerIds.has(it.id) && k % 3 === 0) {
      const a = unitNoise(k * 7 + 3) * Math.PI * 2;
      add({ x: it.x + Math.sin(a) * 0.7, z: it.z + Math.cos(a) * 0.7 });
    }
    if (it.kind === "bar") {
      // Bar faces into the room along its rotY.
      const d = BAR_DEPTH_M / 2 + 0.8;
      for (const along of [-1, 0, 1]) {
        add({
          x: it.x + Math.sin(it.rotY) * d + Math.cos(it.rotY) * along,
          z: it.z + Math.cos(it.rotY) * d - Math.sin(it.rotY) * along,
        });
      }
    }
    if (it.kind === "dance_floor") {
      for (let k2 = 0; k2 < 6; k2++) {
        add({
          x: it.x + (unitNoise(k2 * 11 + 1) - 0.5) * 5,
          z: it.z + (unitNoise(k2 * 13 + 2) - 0.5) * 5,
        });
      }
    }
  });
  const cells = freeCells(grid);
  for (let k = 0; k < 12 && cells.length > 0; k++) {
    out.push(cells[Math.floor(unitNoise(k * 29 + 5) * cells.length) % cells.length]!);
  }
  return out;
}

/** One frame for one walker: chat, pick a destination, or walk the route. */
function stepWalker(
  w: Walker,
  all: Walker[],
  dt: number,
  t: number,
  route: { grid: NavGrid; spots: Point[] } | null,
) {
  w.body.root.scale.setScalar(popScale("guest_standing", w.seed, t) * w.scale);
  w.body.mixer.update(dt);
  if (t < BUILD_DURATION_S || !route) return;

  if (w.mode === "chat") {
    if (t < w.until || route.spots.length === 0) return;
    const target =
      route.spots[Math.floor(draw(w) * route.spots.length) % route.spots.length]!;
    const path = findPath(route.grid, { x: w.x, z: w.z }, target);
    if (!path || path.length === 0) {
      w.until = t + 1;
      return;
    }
    w.path = path;
    w.mode = "walk";
    w.waited = 0;
    w.body.idle?.fadeOut(FADE_S);
    w.body.walk?.reset().fadeIn(FADE_S).play();
    return;
  }

  // Walking: head for the next waypoint.
  const next = w.path[0];
  if (!next) {
    w.mode = "chat";
    w.until = t + CHAT_MIN_S + draw(w) * (CHAT_MAX_S - CHAT_MIN_S);
    w.body.walk?.fadeOut(FADE_S);
    w.body.idle?.reset().fadeIn(FADE_S).play();
    return;
  }
  const dx = next.x - w.x;
  const dz = next.z - w.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) {
    w.path.shift();
    return;
  }
  const ux = dx / dist;
  const uz = dz / dist;

  // Someone close ahead? Wait, then go somewhere else.
  const blocked = all.some((o) => {
    if (o === w) return false;
    const ox = o.x - w.x;
    const oz = o.z - w.z;
    const d = Math.hypot(ox, oz);
    return d < NEAR_M && ox * ux + oz * uz > 0.2 * d;
  });
  if (blocked) {
    w.waited += dt;
    if (w.waited > GIVE_WAY_S) {
      w.path = [];
      w.mode = "chat";
      w.until = t + 0.5 + draw(w);
      w.body.walk?.fadeOut(FADE_S);
      w.body.idle?.reset().fadeIn(FADE_S).play();
    }
  } else {
    w.waited = 0;
    const step = Math.min(SPEED_M_S * dt, dist);
    w.x += ux * step;
    w.z += uz * step;
  }

  // Turn smoothly toward the direction of travel.
  let turn = Math.atan2(ux, uz) - w.heading;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  w.heading += turn * Math.min(1, dt * 8);
  w.body.root.position.set(w.x, 0, w.z);
  w.body.root.rotation.y = w.heading;
}

type Props = {
  /** Standing guests chosen to walk (see pickWalkers). */
  walkers: { it: LayoutItem; i: number }[];
  /** Everything on the floor — furniture and the guests who stay put. */
  items: LayoutItem[];
  room: Room;
  time: () => number;
};

/**
 * Reception guests who mingle: each chats for a few seconds, then walks to
 * the bar, the dance floor, another group or a free spot along a route that
 * goes around every piece of furniture (lib/layout/nav), and waits or picks
 * somewhere else rather than walk into another walker.
 */
export function Walkers({ walkers, items, room, time }: Props) {
  const gltfs = useGLTF([...PEOPLE_MODELS]) as unknown as RiggedModel[];
  const holder = useRef<Group>(null);
  const crowd = useRef<Walker[]>([]);
  const nav = useRef<{ grid: NavGrid; spots: Point[] } | null>(null);

  const walkerIds = useMemo(
    () => new Set(walkers.map((w) => w.it.id)),
    [walkers],
  );
  const grid = useMemo(
    () => buildNavGrid(items, room, { ignore: walkerIds }),
    [items, room, walkerIds],
  );
  const spots = useMemo(
    () => destinations(items, grid, walkerIds),
    [items, grid, walkerIds],
  );

  useEffect(() => {
    nav.current = { grid, spots };
  }, [grid, spots]);

  // Build the animated bodies and hand them to the scene imperatively.
  useEffect(() => {
    const group = holder.current;
    if (!group) return;
    const built: Walker[] = walkers.map(({ it, i }) => {
      const look = lookFor(it, i, false);
      const body = liveBody(gltfs[look.body]!, (slot, fixed) =>
        colourFor(look, slot, fixed),
      );
      const seed = seedFor("guest_standing", i, it.x, it.z);
      body.root.position.set(it.x, 0, it.z);
      body.root.rotation.y = it.rotY;
      body.root.scale.setScalar(0.001);
      if (body.idle) {
        body.idle.play();
        body.idle.time = unitNoise(seed + 5) * 2;
      }
      group.add(body.root);
      return {
        body,
        scale: look.scale,
        seed,
        draws: 0,
        x: it.x,
        z: it.z,
        heading: it.rotY,
        mode: "chat",
        path: [],
        until: BUILD_DURATION_S + 1 + unitNoise(seed + 9) * CHAT_MAX_S,
        waited: 0,
      };
    });
    crowd.current = built;
    return () => {
      for (const w of built) {
        w.body.mixer.stopAllAction();
        group.remove(w.body.root);
      }
      crowd.current = [];
    };
  }, [walkers, gltfs]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = time();
    const all = crowd.current;
    for (const w of all) stepWalker(w, all, dt, t, nav.current);
  });

  return <group ref={holder} />;
}
