"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { bestRoom } from "@/lib/feasibility";
import { layout } from "@/lib/layout";
import type { Spec, Style } from "@/lib/types";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg,#9ec5e8,#e6eef5 55%,#cfc4b0)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#1d2433",
        }}
      >
        Loading scene…
      </div>
    ),
  },
);

const PRESETS: Record<string, Spec> = {
  "Banquet 120": {
    style: "banquet",
    guests: 120,
    stage: "north",
    bar: "east",
    extras: ["dance_floor", "dj_booth"],
    accessible: true,
  },
  "Cabaret 60": {
    style: "cabaret",
    guests: 60,
    stage: "north",
    bar: "none",
    extras: ["projector", "lectern", "buffet"],
    accessible: false,
  },
  "Theatre 180": {
    style: "theatre",
    guests: 180,
    stage: "north",
    bar: "none",
    extras: ["projector", "lectern"],
    accessible: true,
  },
  "Reception 150": {
    style: "reception",
    guests: 150,
    stage: "none",
    bar: "west",
    extras: ["dj_booth", "photo_booth"],
    accessible: false,
  },
  "Overflow 170": {
    style: "banquet",
    guests: 170,
    stage: "north",
    bar: "east",
    extras: ["dance_floor"],
    accessible: false,
  },
};

const STYLE_LABEL: Record<Style, string> = {
  banquet: "Banquet",
  cabaret: "Cabaret",
  theatre: "Theatre",
  reception: "Reception",
};

export default function DevScenePage() {
  const [presetKey, setPresetKey] = useState<string>("Banquet 120");
  const [planView, setPlanView] = useState(false);
  const spec = PRESETS[presetKey]!;
  const feasibility = useMemo(() => bestRoom(DEMO_ROOMS, spec), [spec]);
  const room = feasibility.room ?? DEMO_ROOMS[0]!;
  const items = useMemo(() => layout(room, spec), [room, spec]);

  return (
    <main className="flex h-dvh flex-col bg-[color:var(--background)] text-[color:var(--ink)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-5 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink)]">
            /dev/scene
          </div>
          <div className="font-sans text-lg tracking-tight">
            {room.name} · {STYLE_LABEL[spec.style]} · {spec.guests} guests
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(PRESETS).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPresetKey(k)}
              className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                k === presetKey
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--panel-2)]"
                  : "border-[color:var(--line)] text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/60"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <RoomCanvas
          room={room}
          items={items}
          spec={spec}
          planView={planView}
          onPlanViewChange={setPlanView}
          hud={{
            subtitle: `${STYLE_LABEL[spec.style]} · ${spec.guests} guests`,
            status: feasibility.status,
            used: feasibility.used,
            capacity: feasibility.capacity,
            footnote: `${items.length} items · drag to orbit · shift-drag to pan · scroll to zoom`,
          }}
        />
      </div>
    </main>
  );
}
