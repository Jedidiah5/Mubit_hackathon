"use client";

import { Instance } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  MOVABLE_KINDS,
  movableAnchors,
  pickId,
  snapHalfMetre,
} from "@/lib/layout/movable";
import { footprintSize, orientedSize } from "@/lib/layout/footprint";
import type { LayoutItem, LayoutOverride, Room } from "@/lib/types";
import { Pool } from "../instancing";
import { GhostPiece, HoverHighlight } from "./GhostPiece";

export type EditLayoutSceneProps = {
  room: Room;
  items: LayoutItem[];
  selectedId: string | null;
  candidate: LayoutOverride | null;
  hoverId: string | null;
  valid: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onMoveCandidate: (pose: LayoutOverride) => void;
  /** Nearest 90° camera yaw (radians) for screen-space nudges. */
  viewYaw: number;
  onNudge?: (dx: number, dz: number) => void;
  onRotate?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
};

/**
 * R3F layer for Edit layout: instanced table hit proxies (instanceId → groupId),
 * feature hit boxes, floor raycast, ghost, and keyboard shortcuts.
 */
export function EditLayoutScene({
  room,
  items,
  selectedId,
  candidate,
  hoverId,
  valid,
  onHover,
  onSelect,
  onMoveCandidate,
  viewYaw,
  onNudge,
  onRotate,
  onConfirm,
  onCancel,
}: EditLayoutSceneProps) {
  const anchors = useMemo(() => movableAnchors(items), [items]);
  const tables = useMemo(
    () =>
      anchors.filter(
        (a) => a.kind === "table_round" || a.kind === "high_table",
      ),
    [anchors],
  );
  const features = useMemo(
    () =>
      anchors.filter(
        (a) => a.kind !== "table_round" && a.kind !== "high_table",
      ),
    [anchors],
  );
  const pickTables = useMemo(
    () => tables.filter((t) => pickId(t) !== selectedId),
    [tables, selectedId],
  );
  const tableIds = useMemo(
    () => pickTables.map((t) => pickId(t)),
    [pickTables],
  );

  const selected = selectedId
    ? anchors.find((a) => pickId(a) === selectedId)
    : null;
  const hovered = hoverId
    ? anchors.find((a) => pickId(a) === hoverId)
    : null;

  // Keyboard
  useEffect(() => {
    if (!selectedId || !candidate) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const step = 0.5;
      const { awayX, awayZ, rightX, rightZ } = screenAxes(viewYaw);
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          onNudge?.(awayX * step, awayZ * step);
          break;
        case "ArrowDown":
          e.preventDefault();
          onNudge?.(-awayX * step, -awayZ * step);
          break;
        case "ArrowRight":
          e.preventDefault();
          onNudge?.(rightX * step, rightZ * step);
          break;
        case "ArrowLeft":
          e.preventDefault();
          onNudge?.(-rightX * step, -rightZ * step);
          break;
        case "r":
        case "R":
          e.preventDefault();
          onRotate?.();
          break;
        case "Enter":
          e.preventDefault();
          onConfirm?.();
          break;
        case "Escape":
          e.preventDefault();
          onCancel?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedId,
    candidate,
    viewYaw,
    onNudge,
    onRotate,
    onConfirm,
    onCancel,
  ]);

  const pickTable = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const id = tableIds[e.instanceId ?? -1];
    if (id) onSelect(id);
  };
  const hoverTable = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = tableIds[e.instanceId ?? -1];
    if (id) onHover(id);
  };

  return (
    <group>
      {/* Invisible floor for placing the ghost */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (!selectedId || !candidate) return;
          onMoveCandidate({
            ...candidate,
            x: snapHalfMetre(e.point.x),
            z: snapHalfMetre(e.point.z),
          });
        }}
        onPointerMissed={() => {
          /* keep selection */
        }}
      >
        <planeGeometry args={[room.widthM, room.lengthM]} />
        <meshBasicMaterial
          transparent
          opacity={0.001}
          depthWrite={false}
        />
      </mesh>

      {/* Table groups — one instanced hit volume; instanceId → groupId */}
      {pickTables.length > 0 && (
        <Pool
          count={pickTables.length}
          onClick={pickTable}
          onPointerOver={hoverTable}
          onPointerOut={() => onHover(null)}
        >
          <boxGeometry args={[3.0, 1.0, 3.0]} />
          <meshBasicMaterial
            transparent
            opacity={0.001}
            depthWrite={false}
          />
          {pickTables.map((t, i) => (
            <Instance
              key={tableIds[i]}
              position={[t.x, 0.5, t.z]}
              rotation={[0, t.rotY, 0]}
            />
          ))}
        </Pool>
      )}

      {/* Feature hit boxes */}
      {features.map((f) => {
        const id = pickId(f);
        if (id === selectedId) return null;
        const size = orientedSize(footprintSize(f.kind), f.rotY);
        const h =
          f.kind === "dance_floor"
            ? 0.2
            : f.kind === "stage"
              ? 0.7
              : 1.2;
        return (
          <mesh
            key={id}
            position={[f.x, h / 2, f.z]}
            rotation={[0, f.rotY, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              onHover(null);
              document.body.style.cursor = "auto";
            }}
          >
            <boxGeometry args={[size.w, h, size.d]} />
            <meshBasicMaterial
              transparent
              opacity={0.001}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {hovered && hoverId !== selectedId && <HoverHighlight item={hovered} />}

      {selected && candidate && (
        <GhostPiece kind={selected.kind} pose={candidate} valid={valid} />
      )}
    </group>
  );
}

/** Screen-space axes on the floor from a 90°-snapped camera yaw. */
export function screenAxes(viewYaw: number): {
  awayX: number;
  awayZ: number;
  rightX: number;
  rightZ: number;
} {
  // Camera at (sin θ · s, …, cos θ · s) looks toward origin → away = (−sin θ, −cos θ).
  const awayX = -Math.sin(viewYaw);
  const awayZ = -Math.cos(viewYaw);
  // Screen-right = away rotated +90° in XZ: (−z, x).
  const rightX = -awayZ;
  const rightZ = awayX;
  return { awayX, awayZ, rightX, rightZ };
}

/** Filter items so the selected piece (and its group) is not drawn twice. */
export function omitSelected(
  items: LayoutItem[],
  selectedId: string | null,
): LayoutItem[] {
  if (!selectedId) return items;
  return items.filter(
    (i) => i.id !== selectedId && i.groupId !== selectedId,
  );
}

export function isMovableItem(item: LayoutItem): boolean {
  return (MOVABLE_KINDS as readonly string[]).includes(item.kind);
}
