"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { layout } from "@/lib/layout";
import type { Spec } from "@/lib/types";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#cfc4b0",
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Loading scene…
      </div>
    ),
  },
);

const SPEC: Spec = {
  style: "banquet",
  guests: 120,
  stage: "north",
  bar: "east",
  extras: ["dance_floor"],
  accessible: true,
};

export default function DevScenePage() {
  const room = DEMO_ROOMS[0]!;
  const items = useMemo(() => layout(room, SPEC), [room]);
  const [planView, setPlanView] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#f4efe6",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "0.85rem 1.25rem",
          borderBottom: "1px solid #222",
        }}
      >
        <div>
          <div style={{ fontSize: "0.75rem", opacity: 0.55 }}>/dev/scene</div>
          <div style={{ fontWeight: 600 }}>
            {room.name} · banquet · {SPEC.guests} guests
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPlanView((v) => !v)}
          style={{
            background: planView ? "#c8ff00" : "transparent",
            color: planView ? "#0a0a0a" : "#f4efe6",
            border: "1px solid #c8ff00",
            padding: "0.45rem 0.9rem",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          {planView ? "Isometric" : "Plan view"}
        </button>
      </header>
      <div style={{ flex: 1, minHeight: "70vh" }}>
        <RoomCanvas room={room} items={items} planView={planView} />
      </div>
      <footer
        style={{
          padding: "0.55rem 1.25rem",
          fontSize: "0.75rem",
          opacity: 0.5,
          borderTop: "1px solid #222",
        }}
      >
        Drag horizontally to snap-rotate · scroll to zoom · {items.length} items
      </footer>
    </main>
  );
}
