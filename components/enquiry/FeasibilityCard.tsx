"use client";

import { isTight } from "@/lib/feasibility";
import type { Feasibility, FeasibilityStatus } from "@/lib/types";

const COLOR: Record<FeasibilityStatus, string> = {
  fits: "#0d8f6a",
  warning: "#c47a00",
  cannot: "#d62839",
};

const LABEL: Record<FeasibilityStatus, string> = {
  fits: "Fits",
  warning: "Needs a change",
  cannot: "Can't host",
};

const BG: Record<FeasibilityStatus, string> = {
  fits: "var(--accent)",
  warning: "var(--accent-3)",
  cannot: "var(--accent-4)",
};

type Props = {
  feasibility: Feasibility;
  styleLabel: string;
  rooms: { name: string }[];
  roomOverride: string | null;
  onRoomOverride: (name: string | null) => void;
  compact?: boolean;
};

export function FeasibilityCard({
  feasibility,
  styleLabel,
  rooms,
  roomOverride,
  onRoomOverride,
  compact = false,
}: Props) {
  const color = COLOR[feasibility.status];
  const pct =
    feasibility.capacity > 0
      ? Math.min(100, (feasibility.used / feasibility.capacity) * 100)
      : 100;
  const tight =
    feasibility.status === "fits" &&
    isTight(feasibility.used, feasibility.capacity);

  if (compact) {
    return (
      <div className="nb-panel space-y-2 bg-[color:var(--panel-snow)]/92 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <p className="font-sans text-sm font-extrabold" style={{ color }}>
            {LABEL[feasibility.status]}
            {tight ? " · tight" : ""}
          </p>
          <span className="nb-chip nb-chip-yellow !px-2 !py-0.5 text-[10px]">
            {feasibility.room?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full border border-[color:var(--ink)] bg-white">
            <div
              className="h-full"
              style={{ width: `${pct}%`, background: BG[feasibility.status] }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold text-[color:var(--muted)]">
            {feasibility.used}/{feasibility.capacity}
          </span>
        </div>
        <select
          className="nb-input !px-2 !py-1.5 !text-[11px]"
          value={roomOverride ?? ""}
          onChange={(e) =>
            onRoomOverride(e.target.value === "" ? null : e.target.value)
          }
          aria-label="Room override"
        >
          <option value="">Auto · {styleLabel}</option>
          {rooms.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="nb-panel space-y-3 bg-[color:var(--panel-snow)]/92 p-4 backdrop-blur-md">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
        Feasibility
      </p>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-lg font-bold tracking-tight" style={{ color }}>
          {LABEL[feasibility.status]}
          {tight && (
            <span className="ml-1 font-medium" style={{ color: COLOR.warning }}>
              · tight
            </span>
          )}
        </p>
        <span className="nb-chip nb-chip-yellow">
          {feasibility.room?.name ?? "No room"}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between font-mono text-[11px] font-bold text-[color:var(--muted)]">
          <span>
            {feasibility.used} / {feasibility.capacity} {styleLabel}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full border-2 border-[color:var(--ink)] bg-white">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: BG[feasibility.status] }}
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
        <span className="nb-label">Room override</span>
        <select
          className="nb-input"
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
