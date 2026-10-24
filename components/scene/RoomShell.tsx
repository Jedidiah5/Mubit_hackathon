"use client";

import { useMemo } from "react";
import type { Room } from "@/lib/types";
import { palette } from "./palette";

type WallName = "north" | "south" | "east" | "west";

const WALL_H = 3.2;
const WALL_T = 0.12;
const DOOR_W = 2.2;
const DOOR_H = 2.4;

/** Two walls farthest from the camera (cutaway dollhouse). */
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
};

export function RoomShell({ room, yaw }: Props) {
  const { widthM: w, lengthM: l } = room;
  const hx = w / 2;
  const hz = l / 2;
  const walls = useMemo(() => backWalls(yaw), [yaw]);

  const tiles = useMemo(() => {
    const out: { x: number; z: number; alt: boolean }[] = [];
    for (let ix = 0; ix < w; ix++) {
      for (let iz = 0; iz < l; iz++) {
        out.push({
          x: -hx + ix + 0.5,
          z: -hz + iz + 0.5,
          alt: (ix + iz) % 2 === 0,
        });
      }
    }
    return out;
  }, [w, l, hx, hz]);

  return (
    <group>
      {/* Floor tiles — 1 m × 1 m */}
      {tiles.map((t) => (
        <mesh
          key={`t-${t.x}-${t.z}`}
          position={[t.x, 0, t.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.98, 0.98]} />
          <meshStandardMaterial
            color={t.alt ? palette.floorAlt : palette.floor}
            roughness={0.85}
          />
        </mesh>
      ))}

      {walls.includes("north") && (
        <WallSegment
          cx={0}
          cz={-hz}
          length={w}
          axis="x"
          windows
        />
      )}
      {walls.includes("south") && (
        <SouthWallWithDoor hx={hx} hz={hz} width={w} />
      )}
      {walls.includes("east") && (
        <WallSegment
          cx={hx}
          cz={0}
          length={l}
          axis="z"
          windows
        />
      )}
      {walls.includes("west") && (
        <WallSegment
          cx={-hx}
          cz={0}
          length={l}
          axis="z"
          windows
        />
      )}
    </group>
  );
}

function WallSegment({
  cx,
  cz,
  length,
  axis,
  windows,
}: {
  cx: number;
  cz: number;
  length: number;
  axis: "x" | "z";
  windows?: boolean;
}) {
  const rotY = axis === "x" ? 0 : Math.PI / 2;
  return (
    <group position={[cx, WALL_H / 2, cz]} rotation={[0, rotY, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[length, WALL_H, WALL_T]} />
        <meshStandardMaterial color={palette.wall} roughness={0.9} />
      </mesh>
      {windows &&
        [-0.28, 0.28].map((u) => (
          <mesh
            key={u}
            position={[u * length * 0.55, 0.35, WALL_T * 0.6]}
          >
            <boxGeometry args={[length * 0.22, 1.1, 0.04]} />
            <meshStandardMaterial
              color={palette.window}
              roughness={0.35}
              metalness={0.05}
            />
          </mesh>
        ))}
    </group>
  );
}

function SouthWallWithDoor({
  hx,
  hz,
  width,
}: {
  hx: number;
  hz: number;
  width: number;
}) {
  const side = (width - DOOR_W) / 2;
  const leftCenterX = -hx + side / 2;
  const rightCenterX = hx - side / 2;
  const lintelY = DOOR_H + (WALL_H - DOOR_H) / 2;

  return (
    <group>
      {/* Left / right wall panels with door gap */}
      <mesh
        position={[leftCenterX, WALL_H / 2, hz]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[side, WALL_H, WALL_T]} />
        <meshStandardMaterial color={palette.wall} roughness={0.9} />
      </mesh>
      <mesh
        position={[rightCenterX, WALL_H / 2, hz]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[side, WALL_H, WALL_T]} />
        <meshStandardMaterial color={palette.wall} roughness={0.9} />
      </mesh>
      {/* Lintel above the door */}
      <mesh position={[0, lintelY, hz]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_W, WALL_H - DOOR_H, WALL_T]} />
        <meshStandardMaterial color={palette.wallEdge} roughness={0.9} />
      </mesh>
    </group>
  );
}
