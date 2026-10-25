"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { placementProblem } from "@/lib/layout/placement";
import {
  PLACEMENT_TOAST,
  movableAnchors,
  pickId,
  snapHalfMetre,
} from "@/lib/layout/movable";
import type { PlacementIssue } from "@/lib/layout/placement";
import type {
  AddableKind,
  LayoutItem,
  LayoutKind,
  LayoutOverride,
  Room,
} from "@/lib/types";
import { screenAxes } from "./EditLayoutScene";

/**
 * Pieces that come from the spec (and the quote): deleting one changes the
 * spec instead of hiding it, so pricing and the model's corrections stay true.
 */
export const SPEC_FEATURES = new Set<LayoutKind>([
  "stage",
  "bar",
  "dance_floor",
  "dj_booth",
  "photo_booth",
  "buffet",
]);

type Pose = Pick<LayoutOverride, "x" | "z" | "rotY">;

export type LayoutEditApi = {
  editing: boolean;
  setEditing: (v: boolean) => void;
  selectedId: string | null;
  /** Kind of the selected piece, including one being added. */
  selectedKind: LayoutKind | null;
  candidate: Pose | null;
  hoverId: string | null;
  issue: PlacementIssue | null;
  toast: string | null;
  valid: boolean;
  /** Whether Delete applies to the current selection. */
  canRemove: boolean;
  select: (id: string) => void;
  setHover: (id: string | null) => void;
  setCandidate: (pose: Pose) => void;
  nudge: (dx: number, dz: number) => void;
  nudgeScreen: (
    dir: "up" | "down" | "left" | "right",
    viewYaw: number,
  ) => void;
  rotate: () => void;
  confirm: () => void;
  cancel: () => void;
  reset: () => void;
  /** Start placing a new sign / TV: a ghost appears on free floor. */
  add: (kind: AddableKind) => void;
  remove: () => void;
};

export function useLayoutEdit({
  items,
  room,
  accessible,
  overrides,
  onOverridesChange,
  onRemoveFeature,
}: {
  items: LayoutItem[];
  room: Room;
  accessible: boolean;
  overrides: Record<string, LayoutOverride>;
  onOverridesChange: (
    next: Record<string, LayoutOverride>,
  ) => void | Promise<void>;
  /** Delete a spec feature (stage → none, drop an extra). */
  onRemoveFeature?: (kind: LayoutKind) => void;
}): LayoutEditApi {
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidateState] = useState<Pose | null>(null);
  const [hoverId, setHover] = useState<string | null>(null);
  /** Set while placing a piece that isn't on the floor yet. */
  const [newKind, setNewKind] = useState<AddableKind | null>(null);

  const cancel = useCallback(() => {
    setSelectedId(null);
    setCandidateState(null);
    setNewKind(null);
  }, []);

  useEffect(() => {
    if (!editing) cancel();
  }, [editing, cancel]);

  const selectedKind: LayoutKind | null = useMemo(() => {
    if (!selectedId) return null;
    if (newKind) return newKind;
    return (
      movableAnchors(items).find((a) => pickId(a) === selectedId)?.kind ?? null
    );
  }, [selectedId, newKind, items]);

  const issue: PlacementIssue | null = useMemo(() => {
    if (!selectedId || !candidate) return null;
    return placementProblem(
      selectedId,
      candidate,
      items,
      room,
      accessible,
      newKind ?? undefined,
    );
  }, [selectedId, candidate, items, room, accessible, newKind]);

  const toast = issue ? PLACEMENT_TOAST[issue] : null;
  const valid = Boolean(selectedId && candidate && !issue);
  const canRemove = Boolean(
    selectedId &&
      !newKind &&
      selectedKind &&
      (!SPEC_FEATURES.has(selectedKind) || onRemoveFeature),
  );

  const select = useCallback(
    (id: string) => {
      const anchor = movableAnchors(items).find((a) => pickId(a) === id);
      if (!anchor) return;
      setNewKind(null);
      setSelectedId(id);
      // Start exactly where it stands; moves snap to the 0.5 m grid.
      setCandidateState({ x: anchor.x, z: anchor.z, rotY: anchor.rotY });
    },
    [items],
  );

  const setCandidate = useCallback((pose: Pose) => {
    setCandidateState({
      x: snapHalfMetre(pose.x),
      z: snapHalfMetre(pose.z),
      rotY: pose.rotY,
    });
  }, []);

  const nudge = useCallback((dx: number, dz: number) => {
    setCandidateState((c) =>
      c
        ? {
            ...c,
            x: snapHalfMetre(c.x + dx),
            z: snapHalfMetre(c.z + dz),
          }
        : c,
    );
  }, []);

  const nudgeScreen = useCallback(
    (dir: "up" | "down" | "left" | "right", viewYaw: number) => {
      const { awayX, awayZ, rightX, rightZ } = screenAxes(viewYaw);
      const step = 0.5;
      switch (dir) {
        case "up":
          nudge(awayX * step, awayZ * step);
          break;
        case "down":
          nudge(-awayX * step, -awayZ * step);
          break;
        case "right":
          nudge(rightX * step, rightZ * step);
          break;
        case "left":
          nudge(-rightX * step, -rightZ * step);
          break;
      }
    },
    [nudge],
  );

  const rotate = useCallback(() => {
    setCandidateState((c) =>
      c ? { ...c, rotY: c.rotY + Math.PI / 2 } : c,
    );
  }, []);

  const confirm = useCallback(() => {
    if (!selectedId || !candidate || issue) return;
    // Keep an added piece's kind when it's moved again.
    const entry: LayoutOverride = newKind
      ? { ...candidate, kind: newKind }
      : { ...overrides[selectedId], ...candidate };
    void onOverridesChange({ ...overrides, [selectedId]: entry });
    cancel();
  }, [
    selectedId,
    candidate,
    issue,
    newKind,
    overrides,
    onOverridesChange,
    cancel,
  ]);

  const reset = useCallback(() => {
    void onOverridesChange({});
    cancel();
  }, [onOverridesChange, cancel]);

  const add = useCallback(
    (kind: AddableKind) => {
      let n = 1;
      while (overrides[`added-${kind}-${n}`]) n += 1;
      const id = `added-${kind}-${n}`;
      // First free spot spiralling out from the middle of the room.
      let pose: Pose = { x: 0, z: 0, rotY: 0 };
      const maxRing = Math.ceil(Math.max(room.widthM, room.lengthM));
      search: for (let ring = 0; ring <= maxRing; ring++) {
        const d = ring * 0.5;
        const steps = ring === 0 ? 1 : ring * 8;
        for (let k = 0; k < steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          const p = {
            x: snapHalfMetre(Math.cos(a) * d),
            z: snapHalfMetre(Math.sin(a) * d),
            rotY: 0,
          };
          if (!placementProblem(id, p, items, room, accessible, kind)) {
            pose = p;
            break search;
          }
        }
      }
      setNewKind(kind);
      setSelectedId(id);
      setCandidateState(pose);
    },
    [overrides, items, room, accessible],
  );

  const remove = useCallback(() => {
    if (!selectedId || newKind || !selectedKind) return;
    if (SPEC_FEATURES.has(selectedKind)) {
      onRemoveFeature?.(selectedKind);
      cancel();
      return;
    }
    const anchor = movableAnchors(items).find((a) => pickId(a) === selectedId);
    if (!anchor) return;
    const next = { ...overrides };
    if (next[selectedId]?.kind) {
      // An added piece just goes away.
      delete next[selectedId];
    } else {
      next[selectedId] = {
        x: anchor.x,
        z: anchor.z,
        rotY: anchor.rotY,
        removed: true,
      };
    }
    void onOverridesChange(next);
    cancel();
  }, [
    selectedId,
    newKind,
    selectedKind,
    items,
    overrides,
    onOverridesChange,
    onRemoveFeature,
    cancel,
  ]);

  return {
    editing,
    setEditing,
    selectedId,
    selectedKind,
    candidate,
    hoverId,
    issue,
    toast,
    valid,
    canRemove,
    select,
    setHover,
    setCandidate,
    nudge,
    nudgeScreen,
    rotate,
    confirm,
    cancel,
    reset,
    add,
    remove,
  };
}
