"use client";

import { doc, onSnapshot } from "firebase/firestore";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { layout } from "@/lib/layout";
import { formatGbp, quote } from "@/lib/quote";
import type { Enquiry, Spec } from "@/lib/types";
import { useVenueRooms } from "@/lib/useVenueRooms";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  { ssr: false },
);

export function PlanClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const rooms = useVenueRooms();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), "enquiries", id),
      (snap) => {
        if (!snap.exists()) {
          setError("Floor plan not found.");
          setEnquiry(null);
          return;
        }
        setEnquiry(snap.data() as Enquiry);
        setError(null);
      },
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [id]);

  const spec: Spec | undefined = enquiry?.final ?? enquiry?.parsed;
  const roomOverride = enquiry?.roomOverride ?? null;

  const feasibility = useMemo(() => {
    if (!spec) return null;
    return evaluateRooms(rooms, spec, roomOverride);
  }, [rooms, spec, roomOverride]);

  const room = feasibility?.room ?? rooms[0] ?? DEMO_ROOMS[0]!;
  const items = useMemo(() => {
    if (!spec || !feasibility?.room) return [];
    return layout(feasibility.room, spec);
  }, [spec, feasibility]);

  const liveQuote = useMemo(() => {
    if (!spec || !feasibility?.room?.pricing) return null;
    const named = rooms.find((r) => r.name === feasibility.room!.name);
    const priced = named?.pricing ? named : feasibility.room;
    return quote(priced, spec);
  }, [spec, feasibility, rooms]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-8">
        <p className="font-mono text-sm text-[color:var(--cannot)]">{error}</p>
      </main>
    );
  }

  if (!enquiry || !spec) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-8">
        <p className="font-mono text-sm text-[color:var(--muted)]">
          {!enquiry ? "Loading floor plan…" : "No layout yet for this enquiry."}
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[color:var(--background)] text-[color:var(--ink)]">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            The Wharf Rooms · floor plan
          </p>
          <h1 className="font-sans text-xl tracking-tight sm:text-2xl">
            {enquiry.subject}
          </h1>
          <p className="mt-1 font-mono text-[12px] text-[color:var(--muted)]">
            {room.name} · {spec.style} · {spec.guests} guests
            {liveQuote ? ` · ${formatGbp(liveQuote.total)} inc. VAT` : ""}
          </p>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <RoomCanvas
          room={room}
          items={items}
          spec={spec}
          hud={{
            subtitle: `${spec.style[0]!.toUpperCase()}${spec.style.slice(1)} · ${spec.guests} guests`,
            status: feasibility?.status,
            used: feasibility?.used,
            capacity: feasibility?.capacity,
            footnote: liveQuote
              ? `Estimated total ${formatGbp(liveQuote.total)} inc. VAT`
              : undefined,
          }}
        />
      </div>
    </main>
  );
}
