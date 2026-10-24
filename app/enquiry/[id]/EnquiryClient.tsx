"use client";

import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraftReplyModal } from "@/components/enquiry/DraftReplyModal";
import { QuoteCard } from "@/components/enquiry/QuoteCard";
import { FeasibilityCard } from "@/components/enquiry/FeasibilityCard";
import { SpecForm } from "@/components/enquiry/SpecForm";
import { diffSpec } from "@/lib/corrections";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { layout } from "@/lib/layout";
import { trimEnquiry } from "@/lib/parse";
import { quote } from "@/lib/quote";
import { draftReply } from "@/lib/reply";
import type { Enquiry, Feasibility, Spec } from "@/lib/types";
import { useVenueRooms } from "@/lib/useVenueRooms";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0 grid place-items-center font-mono text-xs uppercase tracking-[0.14em] text-[#1d2433]/70"
        style={{
          background: "linear-gradient(180deg,#9ec5e8,#e6eef5 55%,#cfc4b0)",
        }}
      >
        Loading scene…
      </div>
    ),
  },
);

const parseInFlight = new Set<string>();

type ParseResponse = {
  spec: Spec;
  requestId: string | null;
  latencyMs: number;
  model: string;
  notesUsed: number;
  error?: string;
};

function firestoreFeasibility(f: Feasibility) {
  return {
    status: f.status,
    used: f.used,
    capacity: f.capacity,
    notes: f.notes,
    room: f.room
      ? {
          venueId: f.room.venueId,
          name: f.room.name,
          widthM: f.room.widthM,
          lengthM: f.room.lengthM,
          capacity: f.room.capacity,
          stepFree: f.room.stepFree,
          hasStage: f.room.hasStage,
          hasAV: f.room.hasAV,
          hasBar: f.room.hasBar,
          rules: f.room.rules,
        }
      : null,
  };
}

export function EnquiryClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const rooms = useVenueRooms();

  const [enquiry, setEnquiry] = useState<(Enquiry & { id: string }) | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [planView, setPlanView] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [localSpec, setLocalSpec] = useState<Spec | null>(null);
  const [guestsDraft, setGuestsDraft] = useState("");
  const guestsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const specRef = useRef<Spec | null>(null);
  const skipRemoteSpec = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), "enquiries", id),
      (snap) => {
        if (!snap.exists()) {
          setLoadError("Enquiry not found");
          setEnquiry(null);
          return;
        }
        const data = snap.data() as Enquiry;
        setEnquiry({ id: snap.id, ...data });
        setLoadError(null);

        const remote = data.final ?? data.parsed ?? null;
        if (remote && !skipRemoteSpec.current) {
          specRef.current = remote;
          setLocalSpec(remote);
          setGuestsDraft(String(remote.guests));
        }
        skipRemoteSpec.current = false;
      },
      (err) => setLoadError(err.message),
    );
    return unsub;
  }, [id]);

  const spec = localSpec;

  useEffect(() => {
    if (!enquiry || enquiry.parsed || parseInFlight.has(id)) return;

    parseInFlight.add(id);

    void (async () => {
      setParsing(true);
      setParseError(null);
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: enquiry.body, enquiryId: id }),
        });
        const data = (await res.json()) as ParseResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? `Parse failed (${res.status})`);
        }

        const feasibility = evaluateRooms(rooms, data.spec, null);
        await updateDoc(doc(getDb(), "enquiries", id), {
          parsed: data.spec,
          final: data.spec,
          requestId: data.requestId ?? "",
          latencyMs: data.latencyMs,
          model: data.model,
          notesUsed: data.notesUsed,
          feasibility: firestoreFeasibility(feasibility),
          status: feasibility.status,
          roomOverride: null,
        });
        if (data.error) setParseError(`Validated with fallback: ${data.error}`);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Parse failed");
      } finally {
        parseInFlight.delete(id);
        setParsing(false);
      }
    })();
  }, [enquiry, id, rooms]);

  const roomOverride = enquiry?.roomOverride ?? null;

  const feasibility = useMemo(() => {
    if (!spec) return null;
    return evaluateRooms(rooms, spec, roomOverride);
  }, [spec, roomOverride, rooms]);

  const previewRoom = feasibility?.room ?? rooms[0] ?? DEMO_ROOMS[0]!;

  const items = useMemo(() => {
    if (!spec || !feasibility?.room) return [];
    return layout(feasibility.room, spec);
  }, [spec, feasibility]);

  const persistSpec = useCallback(
    async (next: Spec, override: string | null = roomOverride) => {
      skipRemoteSpec.current = true;
      const feas = evaluateRooms(rooms, next, override);
      await updateDoc(doc(getDb(), "enquiries", id), {
        final: next,
        feasibility: firestoreFeasibility(feas),
        status: feas.status,
        roomOverride: override,
      });
      if (!enquiry?.parsed) return;
      // One doc per enquiry, overwritten: intermediate edits never pile up.
      await setDoc(doc(getDb(), "corrections", id), {
        enquiryId: id,
        requestId: enquiry.requestId ?? "",
        email: trimEnquiry(enquiry.body),
        parsed: enquiry.parsed,
        final: next,
        changes: diffSpec(enquiry.parsed, next),
        at: new Date().toISOString(),
      });
    },
    [id, enquiry, roomOverride, rooms],
  );

  const onSpecChange = useCallback(
    <K extends keyof Spec>(field: K, value: Spec[K]) => {
      const current = specRef.current;
      if (!current) return;
      if (JSON.stringify(current[field]) === JSON.stringify(value)) return;
      const next = { ...current, [field]: value };
      specRef.current = next;
      setLocalSpec(next);
      void persistSpec(next);
    },
    [persistSpec],
  );

  const onGuestsDraft = useCallback(
    (value: string) => {
      setGuestsDraft(value);
      if (guestsTimer.current) clearTimeout(guestsTimer.current);
      guestsTimer.current = setTimeout(() => {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n) || n < 1 || n > 1000) return;
        onSpecChange("guests", n);
      }, 400);
    },
    [onSpecChange],
  );

  const onRoomOverride = useCallback(
    async (name: string | null) => {
      const current = specRef.current;
      if (!current) return;
      const feas = evaluateRooms(rooms, current, name);
      await updateDoc(doc(getDb(), "enquiries", id), {
        roomOverride: name,
        feasibility: firestoreFeasibility(feas),
        status: feas.status,
      });
    },
    [id, rooms],
  );

  const liveQuote = useMemo(() => {
    if (!spec || !feasibility?.room) return null;
    const named = rooms.find((r) => r.name === feasibility.room!.name);
    const room = named?.pricing
      ? named
      : feasibility.room.pricing
        ? feasibility.room
        : null;
    if (!room) return null;
    return quote(room, spec);
  }, [spec, feasibility, rooms]);

  const replyBody = useMemo(() => {
    if (!enquiry || !spec || !feasibility) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return draftReply(enquiry, spec, feasibility, {
      quote: liveQuote,
      planUrl: origin ? `${origin}/p/${id}` : undefined,
    });
  }, [enquiry, spec, feasibility, liveQuote, id]);

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-8 text-[color:var(--ink)]">
        <p className="font-mono text-sm text-[color:var(--cannot)]">{loadError}</p>
      </main>
    );
  }

  if (!enquiry) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-8 text-[color:var(--ink)]">
        <p className="font-mono text-sm text-[color:var(--ink)]/50">Loading enquiry…</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[color:var(--background)] text-[color:var(--ink)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink)] hover:underline"
          >
            ← Inbox
          </Link>
          <h1 className="truncate font-sans text-lg tracking-tight sm:text-xl">
            {enquiry.subject}
          </h1>
          <p className="truncate font-mono text-[11px] text-[color:var(--ink)]/45">
            {enquiry.from}
          </p>
        </div>
        {parsing && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--warning)]">
            Parsing via Mubit…
          </span>
        )}
        {parseError && (
          <span className="max-w-xs truncate font-mono text-[11px] text-[color:var(--cannot)]">
            {parseError}
          </span>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.6fr)_minmax(280px,0.95fr)]">
        <section className="min-h-0 overflow-auto border-b border-[color:var(--line)] p-4 lg:border-b-0 lg:border-r">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Email
          </p>
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[color:var(--ink)]/80">
            {enquiry.body}
          </pre>
        </section>

        <section className="relative min-h-[360px] border-b border-[color:var(--line)] lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="absolute inset-0">
            <RoomCanvas
              room={previewRoom}
              items={items}
              spec={spec ?? undefined}
              planView={planView}
              onPlanViewChange={setPlanView}
              loading={parsing || !spec}
              hud={{
                subtitle: spec
                  ? `${spec.style[0]!.toUpperCase()}${spec.style.slice(1)} · ${spec.guests} guests`
                  : undefined,
                status: feasibility?.status,
                used: feasibility?.used,
                capacity: feasibility?.capacity,
                footnote: enquiry.model
                  ? `${enquiry.model} · ${enquiry.latencyMs ?? "—"} ms`
                  : undefined,
              }}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-4 overflow-auto p-4">
          {spec ? (
            <>
              <SpecForm
                spec={spec}
                onChange={onSpecChange}
                guestsDraft={guestsDraft}
                onGuestsDraft={onGuestsDraft}
              />
              {feasibility && (
                <FeasibilityCard
                  feasibility={feasibility}
                  styleLabel={spec.style}
                  rooms={rooms}
                  roomOverride={roomOverride}
                  onRoomOverride={onRoomOverride}
                />
              )}
              {liveQuote && feasibility?.room && (
                <QuoteCard quote={liveQuote} roomName={feasibility.room.name} />
              )}
              <button
                type="button"
                onClick={() => setDraftOpen(true)}
                className="mt-auto bg-[color:var(--ink)] px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)]"
              >
                Approve & draft reply
              </button>
            </>
          ) : (
            <p className="font-mono text-sm text-[color:var(--ink)]/45">
              {parsing
                ? "Extracting room setup…"
                : "No spec yet — open again after parse."}
            </p>
          )}
        </section>
      </div>

      <footer className="shrink-0 border-t border-[color:var(--line)] px-4 py-2 font-mono text-[11px] text-[color:var(--ink)]/40">
        {enquiry.model
          ? `parsed by ${enquiry.model} via Mubit · ${enquiry.latencyMs ?? "—"} ms · ${
              enquiry.notesUsed
                ? `${enquiry.notesUsed} past correction${enquiry.notesUsed === 1 ? "" : "s"} applied · `
                : ""
            }${enquiry.requestId || "no request id"}`
          : parsing
            ? "calling Mubit…"
            : "not parsed yet"}
      </footer>

      <DraftReplyModal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        subject={enquiry.subject}
        body={replyBody}
      />
    </main>
  );
}
