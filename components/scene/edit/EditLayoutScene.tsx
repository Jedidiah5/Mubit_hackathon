"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  MOVABLE_KINDS,
  movableAnchors,
  pickAt,
  pickId,
  snapHalfMetre,
} from "@/lib/layout/movable";
import type { LayoutItem, LayoutKind, LayoutOverride, Room } from "@/lib/types";
import { GhostPiece, HoverHighlight } from "./GhostPiece";

export type EditLayoutSceneProps = {
  room: Room;
  items: LayoutItem[];
  selectedId: string | null;
  /** Kind of the selected piece (also set while adding a new one). */
  selectedKind: LayoutKind | null;
  candidate: Pose | null;
  hoverId: string | null;
  valid: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onMoveCandidate: (pose: Pose) => void;
  /** Nearest 90° camera yaw (radians) for screen-space nudges. */
  viewYaw: number;
  onNudge?: (dx: number, dz: number) => void;
  onRotate?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
};

type Pose = Pick<LayoutOverride, "x" | "z" | "rotY">;

/** Pointer travel (px) above which a press is a pan, not a click. */
const CLICK_SLOP_PX = 4;

/**
 * R3F layer for Edit layout: one invisible floor that picks pieces by
 * footprint (lib/layout/movable `pickAt`), the hover outline, the ghost, and
 * keyboard shortcuts. With a piece selected, clicking another table's top or a
 * feature switches to it; clicking anywhere else moves the ghost there.
 */
export function EditLayoutScene({
  room,
  items,
  selectedId,
  selectedKind,
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
  onRemove,
}: EditLayoutSceneProps) {
  const anchors = useMemo(() => movableAnchors(items), [items]);

  const hovered = hoverId
    ? anchors.find((a) => pickId(a) === hoverId)
    : null;

  /** The piece a click at this floor point would select, if any. */
  const pieceUnder = (x: number, z: number) =>
    selectedId
      ? pickAt(items, room, x, z, { core: true, skip: selectedId })
      : pickAt(items, room, x, z);

  // Pointer over a piece → hand; moving a selection → crosshair.
  useEffect(() => {
    document.body.style.cursor = hoverId
      ? "pointer"
      : selectedId
        ? "crosshair"
        : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoverId, selectedId]);

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
        case "Delete":
        case "Backspace":
          e.preventDefault();
          onRemove?.();
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
    onRemove,
  ]);

  const onFloorMove = (e: ThreeEvent<PointerEvent>) => {
    const id = pieceUnder(e.point.x, e.point.z);
    if (id !== hoverId) onHover(id);
  };

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Dragging the floor pans the camera; don't treat the release as a click.
    if (e.delta > CLICK_SLOP_PX) return;
    const id = pieceUnder(e.point.x, e.point.z);
    if (id) {
      onSelect(id);
      return;
    }
    if (!selectedId || !candidate) return;
    onMoveCandidate({
      ...candidate,
      x: snapHalfMetre(e.point.x),
      z: snapHalfMetre(e.point.z),
    });
  };

  return (
    <group>
      {/* The only pick target: the floor, a little past the walls */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        onPointerMove={onFloorMove}
        onPointerOut={() => onHover(null)}
        onClick={onFloorClick}
      >
        <planeGeometry args={[room.widthM + 4, room.lengthM + 4]} />
        <meshBasicMaterial
          transparent
          opacity={0.001}
          depthWrite={false}
        />
      </mesh>

      {hovered && hoverId !== selectedId && (
        <HoverHighlight room={room} item={hovered} />
      )}

      {selectedKind && candidate && (
        <GhostPiece
          room={room}
          kind={selectedKind}
          pose={candidate}
          valid={valid}
        />
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
