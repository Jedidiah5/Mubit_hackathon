"use client";

import { isTight } from "@/lib/feasibility";
import type { Feasibility, FeasibilityStatus } from "@/lib/types";

const COLOR: Record<FeasibilityStatus, string> = {
  fits: "#0f7d4c",
  warning: "#9a5b00",
  cannot: "#a3222f",
};

const LABEL: Record<FeasibilityStatus, string> = {
  fits: "Fits",
  warning: "Needs a change",
  cannot: "Can't host",
};

type Props = {
  feasibility: Feasibility;
  styleLabel: string;
  rooms: { name: string }[];
  roomOverride: string | null;
  onRoomOverride: (name: string | null) => void;
};

export function FeasibilityCard({
  feasibility,
  styleLabel,
  rooms,
  roomOverride,
  onRoomOverride,
}: Props) {
  const color = COLOR[feasibility.status];
  const pct =
    feasibility.capacity > 0
      ? Math.min(100, (feasibility.used / feasibility.capacity) * 100)
      : 100;
  const tight =
    feasibility.status === "fits" &&
    isTight(feasibility.used, feasibility.capacity);

  return (
    <div className="space-y-3 border border-[color:var(--line)] bg-[color:var(--panel)] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Feasibility
      </p>

      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sans text-lg tracking-tight" style={{ color }}>
          {LABEL[feasibility.status]}
          {tight && (
            <span className="ml-1 font-medium" style={{ color: COLOR.warning }}>
              · tight
            </span>
          )}
        </p>
        <p className="font-sans text-sm text-[color:var(--ink)]">
          {feasibility.room?.name ?? "No room"}
        </p>
      </div>

      <div>
        <div className="mb-1 flex justify-between font-mono text-[11px] text-[color:var(--muted)]">
          <span>
            {feasibility.used} / {feasibility.capacity} {styleLabel}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 w-full bg-[color:var(--line)]">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>

      {feasibility.notes.length > 0 && (
        <ul className="space-y-1 font-mono text-[11px] leading-snug text-[color:var(--muted)]">
          {feasibility.notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}

      <label className="block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Room override
        </span>
        <select
          className="w-full border border-[color:var(--line)] bg-[color:var(--panel)] px-2.5 py-1.5 font-mono text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
          value={roomOverride ?? ""}
          onChange={(e) =>
            onRoomOverride(e.target.value === "" ? null : e.target.value)
          }
        >
          <option value="">Auto (best fit)</option>
          {rooms.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
