"use client";

import type { Feasibility, FeasibilityStatus } from "@/lib/types";

const COLOR: Record<FeasibilityStatus, string> = {
  fits: "#4ade80",
  warning: "#fbbf24",
  cannot: "#f87171",
};

const ICON: Record<FeasibilityStatus, string> = {
  fits: "✅",
  warning: "⚠️",
  cannot: "❌",
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

  return (
    <div className="space-y-3 border border-[#f4efe6]/12 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
        Feasibility
      </p>

      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sans text-lg tracking-tight" style={{ color }}>
          <span className="mr-1.5" aria-hidden>
            {ICON[feasibility.status]}
          </span>
          {feasibility.room?.name ?? "No room"}
        </p>
      </div>

      <div>
        <div className="mb-1 flex justify-between font-mono text-[11px] text-[#f4efe6]/55">
          <span>
            {feasibility.used} / {feasibility.capacity} {styleLabel}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 w-full bg-[#f4efe6]/10">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>

      {feasibility.notes.length > 0 && (
        <ul className="space-y-1 font-mono text-[11px] leading-snug text-[#f4efe6]/55">
          {feasibility.notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}

      <label className="block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6]/45">
          Room override
        </span>
        <select
          className="w-full border border-[#f4efe6]/15 bg-transparent px-2.5 py-1.5 font-mono text-sm text-[#f4efe6] outline-none focus:border-[#c8ff00]"
          value={roomOverride ?? ""}
          onChange={(e) =>
            onRoomOverride(e.target.value === "" ? null : e.target.value)
          }
        >
          <option value="" className="bg-[#0a0a0a]">
            Auto (best fit)
          </option>
          {rooms.map((r) => (
            <option key={r.name} value={r.name} className="bg-[#0a0a0a]">
              {r.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
