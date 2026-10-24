"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DraftReplyModal } from "@/components/enquiry/DraftReplyModal";
import { FeasibilityCard } from "@/components/enquiry/FeasibilityCard";
import { SpecForm } from "@/components/enquiry/SpecForm";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { layout } from "@/lib/layout";
import { draftReply } from "@/lib/reply";
import type { Enquiry, Feasibility, Spec } from "@/lib/types";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  { ssr: false },
);

const parseInFlight = new Set<string>();

type ParseResponse = {
  spec: Spec;
  requestId: string | null;
  latencyMs: number;
  model: string;
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
    setParsing(true);
    setParseError(null);

    void (async () => {
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

        const feasibility = evaluateRooms(DEMO_ROOMS, data.spec, null);
        await updateDoc(doc(getDb(), "enquiries", id), {
          parsed: data.spec,
          final: data.spec,
          requestId: data.requestId ?? "",
          latencyMs: data.latencyMs,
          model: data.model,
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
  }, [enquiry, id]);

  const roomOverride = enquiry?.roomOverride ?? null;

  const feasibility = useMemo(() => {
    if (!spec) return null;
    return evaluateRooms(DEMO_ROOMS, spec, roomOverride);
  }, [spec, roomOverride]);

  const items = useMemo(() => {
    if (!spec || !feasibility?.room) return [];
    return layout(feasibility.room, spec);
  }, [spec, feasibility]);

  const persistSpec = useCallback(
    async (
      next: Spec,
      field: keyof Spec,
      from: Spec[keyof Spec],
      to: Spec[keyof Spec],
      override: string | null = roomOverride,
    ) => {
      skipRemoteSpec.current = true;
      const feas = evaluateRooms(DEMO_ROOMS, next, override);
      await updateDoc(doc(getDb(), "enquiries", id), {
        final: next,
        feasibility: firestoreFeasibility(feas),
        status: feas.status,
        roomOverride: override,
      });
      await addDoc(collection(getDb(), "corrections"), {
        enquiryId: id,
        requestId: enquiry?.requestId ?? "",
        field,
        from,
        to,
        at: new Date().toISOString(),
      });
    },
    [id, enquiry?.requestId, roomOverride],
  );

  const onSpecChange = useCallback(
    <K extends keyof Spec>(field: K, value: Spec[K]) => {
      const current = specRef.current;
      if (!current) return;
      if (JSON.stringify(current[field]) === JSON.stringify(value)) return;
      const from = current[field];
      const next = { ...current, [field]: value };
      specRef.current = next;
      setLocalSpec(next);
      void persistSpec(next, field, from, value);
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
      const feas = evaluateRooms(DEMO_ROOMS, current, name);
      await updateDoc(doc(getDb(), "enquiries", id), {
        roomOverride: name,
        feasibility: firestoreFeasibility(feas),
        status: feas.status,
      });
    },
    [id],
  );

  const replyBody = useMemo(() => {
    if (!enquiry || !spec || !feasibility) return "";
    return draftReply(enquiry, spec, feasibility);
  }, [enquiry, spec, feasibility]);

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-8 text-[#f4efe6]">
        <p className="font-mono text-sm text-[#f87171]">{loadError}</p>
      </main>
    );
  }

  if (!enquiry) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-8 text-[#f4efe6]">
        <p className="font-mono text-sm text-[#f4efe6]/50">Loading enquiry…</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a] text-[#f4efe6]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#f4efe6]/12 px-4 py-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#c8ff00] hover:underline"
          >
            ← Inbox
          </Link>
          <h1 className="truncate font-sans text-lg tracking-tight sm:text-xl">
            {enquiry.subject}
          </h1>
          <p className="truncate font-mono text-[11px] text-[#f4efe6]/45">
            {enquiry.from}
          </p>
        </div>
        {parsing && (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#fbbf24]">
            Parsing via Mubit…
          </span>
        )}
        {parseError && (
          <span className="max-w-xs truncate font-mono text-[11px] text-[#f87171]">
            {parseError}
          </span>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.6fr)_minmax(280px,0.95fr)]">
        <section className="min-h-0 overflow-auto border-b border-[#f4efe6]/12 p-4 lg:border-b-0 lg:border-r">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
            Email
          </p>
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#f4efe6]/80">
            {enquiry.body}
          </pre>
        </section>

        <section className="relative min-h-[320px] border-b border-[#f4efe6]/12 lg:min-h-0 lg:border-b-0 lg:border-r">
          <button
            type="button"
            onClick={() => setPlanView((v) => !v)}
            className="absolute right-3 top-3 z-10 border border-[#c8ff00] bg-[#0a0a0a]/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#c8ff00] backdrop-blur"
          >
            {planView ? "Isometric" : "Plan view"}
          </button>
          {feasibility?.room && spec ? (
            <RoomCanvas
              room={feasibility.room}
              items={items}
              planView={planView}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-sm text-[#f4efe6]/40">
              {parsing ? "Building room…" : "Waiting for spec…"}
            </div>
          )}
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
                  rooms={DEMO_ROOMS}
                  roomOverride={roomOverride}
                  onRoomOverride={onRoomOverride}
                />
              )}
              <button
                type="button"
                onClick={() => setDraftOpen(true)}
                className="mt-auto bg-[#c8ff00] px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-[#0a0a0a]"
              >
                Approve & draft reply
              </button>
            </>
          ) : (
            <p className="font-mono text-sm text-[#f4efe6]/45">
              {parsing
                ? "Extracting room setup…"
                : "No spec yet — open again after parse."}
            </p>
          )}
        </section>
      </div>

      <footer className="shrink-0 border-t border-[#f4efe6]/12 px-4 py-2 font-mono text-[11px] text-[#f4efe6]/40">
        {enquiry.model
          ? `parsed by ${enquiry.model} via Mubit · ${enquiry.latencyMs ?? "—"} ms · ${enquiry.requestId || "no request id"}`
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
