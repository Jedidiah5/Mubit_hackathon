"use client";

import { Outlines } from "@react-three/drei";
import type { LayoutItem, LayoutKind, LayoutOverride } from "@/lib/types";
import { footprintSize, orientedSize } from "@/lib/layout/footprint";
import { palette } from "../palette";

const ACCENT = "#c8ff00";
const BAD = "#e24b4b";

type Props = {
  kind: LayoutKind;
  pose: LayoutOverride;
  valid: boolean;
};

/** Translucent stand-in for the selected piece at the candidate pose. */
export function GhostPiece({ kind, pose, valid }: Props) {
  const size = orientedSize(footprintSize(kind), pose.rotY);
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
    default:
      return 0.8;
  }
}

/** Accent outline at the live (pre-move) position while hovering. */
export function HoverHighlight({ item }: { item: LayoutItem }) {
  const size = orientedSize(footprintSize(item.kind), item.rotY);
  const r = Math.max(size.w, size.d) * 0.55;
  return (
    <mesh
      position={[item.x, 0.03, item.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[r * 0.72, r, 48]} />
      <meshBasicMaterial
        color={palette.stageEdge}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}
