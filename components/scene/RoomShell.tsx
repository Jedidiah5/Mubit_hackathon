"use client";

import { useMemo } from "react";
import { AdditiveBlending, DoubleSide } from "three";
import type { Room } from "@/lib/types";
import { palette } from "./palette";
import {
  checkerRoughness,
  checkerTexture,
  glowTexture,
  pavingTexture,
} from "./textures";

type WallName = "north" | "south" | "east" | "west";

/** Low walls so the room reads as a flat plan from most angles. */
export const WALL_H = 2.6;
const WALL_T = 0.28;
const KNEE_H = 0.45;
const DADO_H = 0.8;
const SKIRT_H = 0.12;
const CAP_H = 0.08;
const DOOR_W = 2.2;
const DOOR_H = 2.2;
const WINDOW_W = 2.0;
const WINDOW_H = 1.05;
const WINDOW_SILL = 1.05;
const LIGHT_SPACING = 2.2;
const APRON_M = 2.2;

/** Two walls farthest from the camera (full height); the others become knee walls. */
export function backWalls(yaw: number): WallName[] {
  const camX = Math.sin(yaw);
  const camZ = Math.cos(yaw);
  const ranked: { wall: WallName; score: number }[] = [
    { wall: "north", score: camZ },
    { wall: "south", score: -camZ },
    { wall: "east", score: -camX },
    { wall: "west", score: camX },
  ];
  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((r) => r.wall);
}

type Props = {
  room: Room;
  /** Orbit yaw in radians (0 = camera on +z looking north). */
  yaw: number;
  planView?: boolean;
};

/** Room shell renders immediately (no blank canvas while furniture builds). */
export function RoomShell({ room, yaw, planView = false }: Props) {
  const { widthM: w, lengthM: l } = room;
  const hx = w / 2;
  const hz = l / 2;
  const back = useMemo(() => backWalls(yaw), [yaw]);

  const floorMap = useMemo(
    () => checkerTexture(palette.floor, palette.floorAlt, palette.grout),
    [],
  );
  const roughMap = useMemo(() => checkerRoughness(), []);
  const paving = useMemo(
    () => pavingTexture(palette.paving, palette.pavingLine),
    [],
  );

  // Repeat: one texture = 2 m × 2 m
  if (floorMap) floorMap.repeat.set(w / 2, l / 2);
  if (roughMap) roughMap.repeat.set(w / 2, l / 2);
  if (paving) paving.repeat.set((w + APRON_M * 2) / 2, (l + APRON_M * 2) / 2);

  const walls: WallName[] = ["north", "south", "east", "west"];

  return (
    <group>
      <World w={w} l={l} paving={paving} />

      {/* Floor slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial
          map={floorMap ?? undefined}
          roughnessMap={roughMap ?? undefined}
          roughness={0.55}
          metalness={0}
          envMapIntensity={0.6}
        />
      </mesh>
      {/* Slab edge */}
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.22, l + 0.3]} />
        <meshStandardMaterial color={palette.wallDado} roughness={0.9} />
      </mesh>

      {walls.map((wall) => (
        <Wall
          key={wall}
          wall={wall}
          hx={hx}
          hz={hz}
          full={planView ? false : back.includes(wall)}
        />
      ))}

      {!planView && <Downlights hx={hx} hz={hz} walls={back} />}
    </group>
  );
}

function wallTransform(wall: WallName, hx: number, hz: number) {
  switch (wall) {
    case "north":
      return { pos: [0, 0, -hz - WALL_T / 2] as const, rot: 0, len: hx * 2 };
    case "south":
      return { pos: [0, 0, hz + WALL_T / 2] as const, rot: Math.PI, len: hx * 2 };
    case "east":
      return { pos: [hx + WALL_T / 2, 0, 0] as const, rot: -Math.PI / 2, len: hz * 2 };
    default:
      return { pos: [-hx - WALL_T / 2, 0, 0] as const, rot: Math.PI / 2, len: hz * 2 };
  }
}

/**
 * Wall in local space: runs along local X, interior faces +Z local.
 * Full walls get dado, skirting, cap trim, windows (or door on south).
 */
function Wall({
  wall,
  hx,
  hz,
  full,
}: {
  wall: WallName;
  hx: number;
  hz: number;
  full: boolean;
}) {
  const { pos, rot, len } = wallTransform(wall, hx, hz);
  const outer = len + WALL_T * 2;
  const h = full ? WALL_H : KNEE_H;
  const hasDoor = wall === "south";

  return (
    <group position={[pos[0], pos[1], pos[2]]} rotation={[0, rot, 0]}>
      {hasDoor && full ? (
        <DoorWall outer={outer} h={h} />
      ) : (
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[outer, h, WALL_T]} />
          <meshStandardMaterial color={palette.wall} roughness={0.92} />
        </mesh>
      )}

      {/* Cap trim */}
      <mesh position={[0, h + CAP_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[outer + 0.04, CAP_H, WALL_T + 0.06]} />
        <meshStandardMaterial color={palette.wallCap} roughness={0.7} />
      </mesh>

      {/* Interior skirting */}
      <mesh position={[0, SKIRT_H / 2, WALL_T / 2 + 0.015]}>
        <boxGeometry args={[len, SKIRT_H, 0.03]} />
        <meshStandardMaterial color={palette.skirting} roughness={0.6} />
      </mesh>

      {full && (
        <>
          {/* Dado panel */}
          <mesh position={[0, DADO_H / 2 + SKIRT_H, WALL_T / 2 + 0.008]}>
            <boxGeometry args={[len, DADO_H, 0.016]} />
            <meshStandardMaterial color={palette.wallDado} roughness={0.75} />
          </mesh>
          <mesh
            position={[0, DADO_H + SKIRT_H + 0.025, WALL_T / 2 + 0.02]}
          >
            <boxGeometry args={[len, 0.05, 0.04]} />
            <meshStandardMaterial color={palette.wallCap} roughness={0.6} />
          </mesh>
          {!hasDoor && <Windows len={len} />}
          {hasDoor && <Windows len={len} skipCentre />}
        </>
      )}
    </group>
  );
}

function DoorWall({ outer, h }: { outer: number; h: number }) {
  const side = (outer - DOOR_W) / 2;
  const lintelH = h - DOOR_H;
  return (
    <group>
      <mesh position={[-outer / 2 + side / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[side, h, WALL_T]} />
        <meshStandardMaterial color={palette.wall} roughness={0.92} />
      </mesh>
      <mesh position={[outer / 2 - side / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[side, h, WALL_T]} />
        <meshStandardMaterial color={palette.wall} roughness={0.92} />
      </mesh>
      <mesh position={[0, DOOR_H + lintelH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_W, lintelH, WALL_T]} />
        <meshStandardMaterial color={palette.wall} roughness={0.92} />
      </mesh>
      {/* Door frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR_W / 2 + 0.05), DOOR_H / 2, 0]}>
          <boxGeometry args={[0.1, DOOR_H, WALL_T + 0.08]} />
          <meshStandardMaterial color={palette.windowFrame} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_H + 0.05, 0]}>
        <boxGeometry args={[DOOR_W + 0.2, 0.1, WALL_T + 0.08]} />
        <meshStandardMaterial color={palette.windowFrame} roughness={0.6} />
      </mesh>
      {/* Double doors, open inward */}
      {[-1, 1].map((s) => (
        <mesh
          key={`leaf-${s}`}
          position={[s * (DOOR_W / 2 - 0.02), DOOR_H / 2 - 0.02, WALL_T / 2 + 0.45]}
          rotation={[0, s * 1.15, 0]}
          castShadow
        >
          <boxGeometry args={[DOOR_W / 2 - 0.04, DOOR_H - 0.04, 0.05]} />
          <meshStandardMaterial color={palette.door} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Windows({ len, skipCentre = false }: { len: number; skipCentre?: boolean }) {
  const count = Math.max(1, Math.floor(len / 4.5));
  const xs: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * (len / count) - len / 2;
    if (skipCentre && Math.abs(x) < DOOR_W / 2 + WINDOW_W / 2 + 0.3) continue;
    xs.push(x);
  }
  const cy = WINDOW_SILL + WINDOW_H / 2;
  return (
    <group>
      {xs.map((x) => (
        <group key={x} position={[x, cy, 0]}>
          {/* Frame */}
          <mesh>
            <boxGeometry args={[WINDOW_W + 0.12, WINDOW_H + 0.12, WALL_T + 0.04]} />
            <meshStandardMaterial color={palette.windowFrame} roughness={0.6} />
          </mesh>
          {/* Glass */}
          <mesh>
            <boxGeometry args={[WINDOW_W, WINDOW_H, WALL_T + 0.06]} />
            <meshStandardMaterial
              color={palette.window}
              roughness={0.15}
              metalness={0.2}
              transparent
              opacity={0.85}
            />
          </mesh>
          {/* Mullions */}
          <mesh position={[0, 0, WALL_T / 2 + 0.035]}>
            <boxGeometry args={[0.05, WINDOW_H, 0.02]} />
            <meshStandardMaterial color={palette.windowFrame} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, WALL_T / 2 + 0.035]}>
            <boxGeometry args={[WINDOW_W, 0.05, 0.02]} />
            <meshStandardMaterial color={palette.windowFrame} roughness={0.6} />
          </mesh>
          {/* Sill */}
          <mesh position={[0, -WINDOW_H / 2 - 0.08, WALL_T / 2 + 0.05]}>
            <boxGeometry args={[WINDOW_W + 0.24, 0.06, 0.14]} />
            <meshStandardMaterial color={palette.wallCap} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Emissive downlights along the top of the back walls + warm pools on the floor. */
function Downlights({
  hx,
  hz,
  walls,
}: {
  hx: number;
  hz: number;
  walls: WallName[];
}) {
  const glow = useMemo(() => glowTexture(), []);
  const lights = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    for (const wall of walls) {
      const along = wall === "north" || wall === "south" ? hx * 2 : hz * 2;
      const n = Math.max(2, Math.round(along / LIGHT_SPACING));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const a = -along / 2 + t * along;
        const inset = 0.08;
        switch (wall) {
          case "north":
            out.push({ x: a, z: -hz + inset, rot: 0 });
            break;
          case "south":
            out.push({ x: a, z: hz - inset, rot: Math.PI });
            break;
          case "east":
            out.push({ x: hx - inset, z: a, rot: -Math.PI / 2 });
            break;
          case "west":
            out.push({ x: -hx + inset, z: a, rot: Math.PI / 2 });
            break;
        }
      }
    }
    return out;
  }, [hx, hz, walls]);

  return (
    <group>
      {lights.map((lt, i) => (
        <group key={i} position={[lt.x, 0, lt.z]} rotation={[0, lt.rot, 0]}>
          {/* Fixture housing + emissive lens near the cap */}
          <mesh position={[0, WALL_H - 0.18, 0.12]}>
            <boxGeometry args={[0.28, 0.1, 0.16]} />
            <meshStandardMaterial color={palette.skirting} roughness={0.5} />
          </mesh>
          <mesh position={[0, WALL_H - 0.24, 0.13]}>
            <boxGeometry args={[0.2, 0.03, 0.1]} />
            <meshStandardMaterial
              color={palette.downlight}
              emissive={palette.downlight}
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
          {/* Wall wash */}
          <mesh position={[0, WALL_H - 0.95, 0.03]}>
            <planeGeometry args={[1.1, 1.5]} />
            <meshBasicMaterial
              map={glow ?? undefined}
              color={palette.lightPool}
              transparent
              opacity={0.28}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* Floor pool */}
          <mesh position={[0, 0.012, 1.05]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.0, 3.0]} />
            <meshBasicMaterial
              map={glow ?? undefined}
              color={palette.lightPool}
              transparent
              opacity={0.38}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Paved apron and soft lawn so the room doesn't float. */
function World({
  w,
  l,
  paving,
}: {
  w: number;
  l: number;
  paving: ReturnType<typeof pavingTexture>;
}) {
  const apronW = w + APRON_M * 2;
  const apronL = l + APRON_M * 2;
  const lawnR = Math.max(apronW, apronL) * 0.9;
  return (
    <group>
      <mesh position={[0, -0.26, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[lawnR, 64]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <mesh position={[0, -0.255, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[lawnR * 0.72, lawnR, 64]} />
        <meshStandardMaterial color={palette.groundDark} roughness={1} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[apronW, apronL]} />
        <meshStandardMaterial map={paving ?? undefined} roughness={0.95} />
      </mesh>
      {/* Steps up to the south door */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          position={[0, -0.25 + 0.06 + i * 0.08, l / 2 + 0.6 + i * 0.35]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.4 - i * 0.4, 0.12, 0.6]} />
          <meshStandardMaterial color={palette.wallCap} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
