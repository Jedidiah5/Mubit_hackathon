"use client";

import { Html, Outlines } from "@react-three/drei";
import type { LayoutItem, LayoutKind, LayoutOverride, Room } from "@/lib/types";
import { footprintSize, orientedSize } from "@/lib/layout/footprint";
import { TABLE_PICK, pieceLabel } from "@/lib/layout/movable";
import { palette } from "../palette";

const ACCENT = "#c8ff00";
const BAD = "#e24b4b";

type Props = {
  room: Room;
  kind: LayoutKind;
  pose: Pick<LayoutOverride, "x" | "z" | "rotY">;
  valid: boolean;
};

/** Translucent stand-in for the selected piece at the candidate pose. */
export function GhostPiece({ room, kind, pose, valid }: Props) {
  const size = orientedSize(footprintSize(kind, room, pose.rotY), pose.rotY);
  const color = valid ? ACCENT : BAD;
  const y = ghostHeight(kind);

  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.rotY, 0]}>
      {kind === "table_round" || kind === "high_table" ? (
        <mesh position={[0, kind === "high_table" ? 1.05 : 0.4, 0]}>
          <cylinderGeometry
            args={[
              kind === "high_table" ? 0.42 : 0.95,
              kind === "high_table" ? 0.42 : 0.95,
              kind === "high_table" ? 0.08 : 0.75,
              28,
            ]}
          />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.5}
            depthWrite={false}
            roughness={0.6}
          />
          <Outlines thickness={2.5} color={color} />
        </mesh>
      ) : kind === "dance_floor" ? (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size.w, size.d]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.5}
            depthWrite={false}
            roughness={0.8}
          />
          <Outlines thickness={3} color={color} />
        </mesh>
      ) : (
        <mesh position={[0, y / 2, 0]}>
          <boxGeometry args={[size.w, y, size.d]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.5}
            depthWrite={false}
            roughness={0.7}
          />
          <Outlines thickness={2.5} color={color} />
        </mesh>
      )}
      {/* Soft ground ring so the ghost reads on busy floors */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[
            Math.max(size.w, size.d) * 0.35,
            Math.max(size.w, size.d) * 0.52,
            48,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ghostHeight(kind: LayoutKind): number {
  switch (kind) {
    case "stage":
      return 0.6;
    case "bar":
      return 1.1;
    case "dj_booth":
    case "photo_booth":
      return 1.4;
    case "sign":
      return 1.6;
    case "tv":
      return 1.7;
    default:
      return 0.8;
  }
}

const EDGE = 0.12;

/**
 * What a click would grab: the piece's pick area outlined at its live
 * position (a disc for tables, the footprint for everything else) plus its
 * name. Drawn over the furniture so it reads from straight above.
 */
export function HoverHighlight({ room, item }: { room: Room; item: LayoutItem }) {
  const disc = TABLE_PICK[item.kind];
  const size = orientedSize(
    footprintSize(item.kind, room, item.rotY),
    item.rotY,
  );
  const line = (
    <meshBasicMaterial
      color={palette.stageEdge}
      transparent
      opacity={0.95}
      depthTest={false}
      depthWrite={false}
    />
  );
  const bars: [number, number, number, number][] = [
    // [x, z, w, d] — the four sides of the footprint
    [0, -size.d / 2 + EDGE / 2, size.w, EDGE],
    [0, size.d / 2 - EDGE / 2, size.w, EDGE],
    [-size.w / 2 + EDGE / 2, 0, EDGE, size.d],
    [size.w / 2 - EDGE / 2, 0, EDGE, size.d],
  ];

  return (
    <group position={[item.x, 0, item.z]}>
      {disc ? (
        <mesh
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={10}
        >
          <ringGeometry args={[disc.full - EDGE, disc.full, 48]} />
          {line}
        </mesh>
      ) : (
        bars.map(([x, z, w, d], i) => (
          <mesh
            key={i}
            position={[x, 0.03, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={10}
          >
            <planeGeometry args={[w, d]} />
            {line}
          </mesh>
        ))
      )}
      <Html center position={[0, 1.8, 0]} style={{ pointerEvents: "none" }}>
        <div className="btf-pill btf-pill--dark">{pieceLabel(item)}</div>
      </Html>
    </group>
  );
}
