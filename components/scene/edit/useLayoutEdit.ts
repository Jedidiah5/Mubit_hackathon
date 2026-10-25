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
import type { LayoutItem, LayoutOverride, Room } from "@/lib/types";
import { screenAxes } from "./EditLayoutScene";

export type LayoutEditApi = {
  editing: boolean;
  setEditing: (v: boolean) => void;
  selectedId: string | null;
  candidate: LayoutOverride | null;
  hoverId: string | null;
  issue: PlacementIssue | null;
  toast: string | null;
  valid: boolean;
  select: (id: string) => void;
  setHover: (id: string | null) => void;
  setCandidate: (pose: LayoutOverride) => void;
  nudge: (dx: number, dz: number) => void;
  nudgeScreen: (
    dir: "up" | "down" | "left" | "right",
    viewYaw: number,
  ) => void;
  rotate: () => void;
  confirm: () => void;
  cancel: () => void;
  reset: () => void;
};

export function useLayoutEdit({
  items,
  room,
  accessible,
  overrides,
  onOverridesChange,
}: {
  items: LayoutItem[];
  room: Room;
  accessible: boolean;
  overrides: Record<string, LayoutOverride>;
  onOverridesChange: (
    next: Record<string, LayoutOverride>,
  ) => void | Promise<void>;
}): LayoutEditApi {
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidateState] = useState<LayoutOverride | null>(null);
  const [hoverId, setHover] = useState<string | null>(null);

  const cancel = useCallback(() => {
    setSelectedId(null);
    setCandidateState(null);
  }, []);

  useEffect(() => {
    if (!editing) cancel();
  }, [editing, cancel]);

  const issue: PlacementIssue | null = useMemo(() => {
    if (!selectedId || !candidate) return null;
    return placementProblem(
      selectedId,
      candidate,
      items,
      room,
      accessible,
    );
  }, [selectedId, candidate, items, room, accessible]);

  const toast = issue ? PLACEMENT_TOAST[issue] : null;
  const valid = Boolean(selectedId && candidate && !issue);

  const select = useCallback(
    (id: string) => {
      const anchor = movableAnchors(items).find((a) => pickId(a) === id);
      if (!anchor) return;
      setSelectedId(id);
      setCandidateState({
        x: snapHalfMetre(anchor.x),
        z: snapHalfMetre(anchor.z),
        rotY: anchor.rotY,
      });
    },
    [items],
  );

  const setCandidate = useCallback((pose: LayoutOverride) => {
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
    const next = { ...overrides, [selectedId]: candidate };
    void onOverridesChange(next);
    cancel();
  }, [selectedId, candidate, issue, overrides, onOverridesChange, cancel]);

  const reset = useCallback(() => {
    void onOverridesChange({});
    cancel();
  }, [onOverridesChange, cancel]);

  return {
    editing,
    setEditing,
    selectedId,
    candidate,
    hoverId,
    issue,
    toast,
    valid,
    select,
    setHover,
    setCandidate,
    nudge,
    nudgeScreen,
    rotate,
    confirm,
    cancel,
    reset,
  };
}
