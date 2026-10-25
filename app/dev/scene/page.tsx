"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { bestRoom } from "@/lib/feasibility";
import { layout } from "@/lib/layout";
import type { Spec, Style } from "@/lib/types";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,#9ec5e8,#e6eef5_55%,#cfc4b0)] font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--ink)]">
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
    <main className="flex h-dvh flex-col text-[color:var(--ink)]">
      <header className="flex shrink-0 flex-col gap-3 border-b-2 border-[color:var(--ink)] bg-[color:var(--panel-snow)] px-4 py-3 sm:px-5">
        <AppNav current="/dev/scene" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              /dev/scene
            </p>
            <h1 className="font-sans text-lg font-extrabold tracking-tight sm:text-xl">
              {room.name} · {STYLE_LABEL[spec.style]} · {spec.guests} guests
            </h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PRESETS).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPresetKey(k)}
                className={`rounded-full border-2 border-[color:var(--ink)] px-3 py-1.5 font-sans text-[11px] font-bold shadow-[2px_2px_0_0_#151515] transition ${
                  k === presetKey
                    ? "bg-[color:var(--accent-3)]"
                    : "bg-[color:var(--panel-snow)] hover:bg-[color:var(--panel-2)]"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
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
            showLegend: true,
          }}
        />
      </div>
    </main>
  );
}
