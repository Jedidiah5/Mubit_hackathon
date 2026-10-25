"use client";

import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChangeRequestBanner } from "@/components/enquiry/ChangeRequestBanner";
import { DraftReplyModal } from "@/components/enquiry/DraftReplyModal";
import { ReviewBanner } from "@/components/enquiry/ReviewBanner";
import { QuoteCard } from "@/components/enquiry/QuoteCard";
import { FeasibilityCard } from "@/components/enquiry/FeasibilityCard";
import { SpecForm } from "@/components/enquiry/SpecForm";
import { diffSpec } from "@/lib/corrections";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { applyOverrides, layout } from "@/lib/layout";
import { trimEnquiry } from "@/lib/parse";
import { quote } from "@/lib/quote";
import { enquiryText, missingDetails, needsInfo } from "@/lib/missing";
import { draftReply, followUpReply } from "@/lib/reply";
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
  const [draftKind, setDraftKind] = useState<"reply" | "followup">("reply");
  const [localSpec, setLocalSpec] = useState<Spec | null>(null);
  const [guestsDraft, setGuestsDraft] = useState("");
  const [emailExpanded, setEmailExpanded] = useState(false);
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

        // /api/parse with enquiryId persists parsed + final + feasibility.
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
    return evaluateRooms(rooms, spec, roomOverride);
  }, [spec, roomOverride, rooms]);

  const previewRoom = feasibility?.room ?? rooms[0] ?? DEMO_ROOMS[0]!;

  const items = useMemo(() => {
    if (!spec || !feasibility?.room) return [];
    return applyOverrides(
      layout(feasibility.room, spec),
      enquiry?.final?.overrides,
    );
  }, [spec, feasibility, enquiry?.final?.overrides]);

  const persistSpec = useCallback(
    async (next: Spec, override: string | null = roomOverride) => {
      skipRemoteSpec.current = true;
      const feas = evaluateRooms(rooms, next, override);
      await updateDoc(doc(getDb(), "enquiries", id), {
        final: next,
        feasibility: firestoreFeasibility(feas),
        roomOverride: override,
        approvedAt: null,
        verdict: null,
        status: "received",
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
        source: "coordinator",
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
        approvedAt: null,
        verdict: null,
        status: "received",
      });
    },
    [id, rooms],
  );

  const approved = Boolean(enquiry?.approvedAt);
  const parsedSpec = enquiry?.parsed;
  const pendingChange =
    enquiry?.changeRequest?.status === "pending"
      ? enquiry.changeRequest
      : null;

  const subject = enquiry?.subject;
  const body = enquiry?.body;
  const missing = useMemo(
    () => (body != null ? missingDetails(enquiryText({ subject: subject ?? "", body })) : []),
    [subject, body],
  );
  const blocked = needsInfo(missing);

  const onFollowUp = useCallback(() => {
    setDraftKind("followup");
    setDraftOpen(true);
  }, []);

  const onApprove = useCallback(async () => {
    setDraftKind("reply");
    setDraftOpen(true);
    const current = specRef.current;
    if (approved || !current || !parsedSpec) return;
    await updateDoc(doc(getDb(), "enquiries", id), {
      approvedAt: new Date().toISOString(),
      status: "proposed",
      verdict: diffSpec(parsedSpec, current).length > 0 ? "corrected" : "good",
    });
  }, [approved, parsedSpec, id]);

  const onAcceptClientChanges = useCallback(async () => {
    const req = enquiry?.changeRequest;
    const current = specRef.current;
    if (!req || req.status !== "pending" || !current || !enquiry?.parsed) return;
    const next = req.spec;
    const feas = evaluateRooms(rooms, next, roomOverride);
    skipRemoteSpec.current = true;
    specRef.current = next;
    setLocalSpec(next);
    setGuestsDraft(String(next.guests));
    await updateDoc(doc(getDb(), "enquiries", id), {
      final: next,
      feasibility: firestoreFeasibility(feas),
      changeRequest: { ...req, status: "accepted" },
      status: "proposed",
      approvedAt: new Date().toISOString(),
      verdict: "corrected",
    });
    await setDoc(doc(getDb(), "corrections", id), {
      enquiryId: id,
      requestId: enquiry.requestId ?? "",
      email: trimEnquiry(enquiry.body),
      parsed: enquiry.parsed,
      final: next,
      changes: diffSpec(enquiry.parsed, next),
      at: new Date().toISOString(),
      source: "client",
    });
  }, [enquiry, id, rooms, roomOverride]);

  const onDismissClientChanges = useCallback(async () => {
    const req = enquiry?.changeRequest;
    if (!req || req.status !== "pending") return;
    await updateDoc(doc(getDb(), "enquiries", id), {
      changeRequest: { ...req, status: "dismissed" },
      status: "proposed",
    });
  }, [enquiry, id]);

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
    if (!enquiry) return "";
    if (draftKind === "followup") return followUpReply(enquiry, missing);
    if (!spec || !feasibility) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return draftReply(enquiry, spec, feasibility, {
      quote: liveQuote,
      planUrl: origin ? `${origin}/p/${id}` : undefined,
      askDate: missing.includes("date"),
    });
  }, [enquiry, draftKind, missing, spec, feasibility, liveQuote, id]);

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
    <main
      className={`enquiry-with-mail relative h-[100dvh] overflow-hidden text-[color:var(--ink)] ${
        emailExpanded ? "email-open" : ""
      }`}
    >
      {/* Full-bleed floor plan */}
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
            showLegend: false,
          }}
        />
      </div>

      {/*
        Overlay grid — corners only, centre stays open for the floor plan.
        ┌──────────┬────────────┬──────────┐
        │ mail     │            │ review   │
        ├──────────┤   canvas   ├──────────┤
        │ fit      │            │ quote+cta│
        └──────────┴─── spec ───┴──────────┘
      */}
      <div className="enquiry-overlay pointer-events-none absolute inset-0 z-30 grid grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] gap-2 p-3 lg:grid-cols-[220px_minmax(0,1fr)_220px] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-3">
        {/* TL — nav + email */}
        <div className="pointer-events-auto col-start-1 row-start-1 flex max-w-full flex-col gap-2 self-start lg:max-w-none">
          <div className="rounded-[16px] border-[2.5px] border-[color:var(--ink)] bg-[color:var(--panel-snow)]/95 px-2.5 py-2 shadow-[3px_3px_0_0_#151515] backdrop-blur-sm">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Link href="/" className="nb-chip inline-flex !px-2 !py-0.5 !shadow-none">
                ← Inbox
              </Link>
              {parsing && (
                <span className="nb-chip nb-chip-yellow !px-2 !py-0.5">Parsing…</span>
              )}
            </div>
            <h1 className="truncate font-sans text-sm font-extrabold tracking-tight">
              {enquiry.subject}
            </h1>
          </div>

          <div className="rounded-[20px] rounded-tl-md border-[3px] border-[color:var(--ink)] bg-[#cfe4ff] px-3 py-2.5 shadow-[4px_4px_0_0_#151515]">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-[color:var(--ink)] bg-white"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" width="12" height="12" aria-label="Gmail">
                  <path
                    fill="#EA4335"
                    d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11Z"
                  />
                  <path
                    fill="#fff"
                    d="M3.2 6.2 12 12.6l8.8-6.4v1.7L12 14.4 3.2 7.9V6.2Z"
                  />
                </svg>
              </span>
              <p className="min-w-0 truncate font-sans text-[12px] font-extrabold">
                {enquiry.from.split("<")[0]?.trim() || enquiry.from}
              </p>
            </div>
            <pre
              className={`whitespace-pre-wrap font-sans text-[12px] leading-snug ${
                emailExpanded
                  ? "max-h-[28vh] overflow-y-auto"
                  : "max-h-[2.8rem] overflow-hidden"
              }`}
            >
              {enquiry.body}
            </pre>
            {enquiry.body.length > 100 && (
              <button
                type="button"
                onClick={() => setEmailExpanded((v) => !v)}
                className="mt-1.5 font-sans text-[11px] font-extrabold underline underline-offset-2"
              >
                {emailExpanded ? "Less" : "More"}
              </button>
            )}
          </div>
        </div>

        {/* TR — review (own row on mobile so it doesn't stack on the email) */}
        <div className="pointer-events-auto col-start-1 row-start-2 self-start lg:col-start-3 lg:row-start-1 lg:justify-self-stretch">
          {spec ? (
            <div className="space-y-2 lg:max-w-none">
              <ReviewBanner
                approvedAt={enquiry.approvedAt ?? null}
                verdict={enquiry.verdict ?? null}
                missing={missing}
              />
              {pendingChange && (
                <ChangeRequestBanner
                  changeRequest={pendingChange}
                  current={spec}
                  onAccept={() => void onAcceptClientChanges()}
                  onDismiss={() => void onDismissClientChanges()}
                />
              )}
            </div>
          ) : (
            <div className="rounded-[16px] border-[2.5px] border-[color:var(--ink)] bg-[color:var(--panel-snow)]/95 px-3 py-2 shadow-[3px_3px_0_0_#151515]">
              <p className="font-mono text-xs text-[color:var(--muted)]">
                {parsing ? "Extracting…" : "No spec yet"}
              </p>
            </div>
          )}
        </div>

        {/* BL — feasibility (desktop only) */}
        {spec && feasibility && (
          <div className="pointer-events-auto col-start-1 row-start-3 hidden self-end lg:block">
            <FeasibilityCard
              compact
              feasibility={feasibility}
              styleLabel={spec.style}
              rooms={rooms}
              roomOverride={roomOverride}
              onRoomOverride={onRoomOverride}
            />
          </div>
        )}

        {/* BC — compact spec */}
        {spec && (
          <div className="pointer-events-auto col-start-1 row-start-4 self-end lg:col-start-2 lg:row-start-3">
            <SpecForm
              compact
              spec={spec}
              onChange={onSpecChange}
              guestsDraft={guestsDraft}
              onGuestsDraft={onGuestsDraft}
            />
          </div>
        )}

        {/* BR — quote + CTA */}
        {spec && (
          <div className="pointer-events-auto col-start-1 row-start-5 flex flex-col gap-2 self-end lg:col-start-3 lg:row-start-3">
            {liveQuote && feasibility?.room && (
              <QuoteCard
                compact
                quote={liveQuote}
                roomName={feasibility.room.name}
              />
            )}
            {blocked && !approved ? (
              <>
                <button
                  type="button"
                  onClick={onFollowUp}
                  className="nb-btn nb-btn-ink nb-btn-pill w-full !py-2.5 !text-sm"
                >
                  Draft follow-up
                </button>
                <button
                  type="button"
                  onClick={() => void onApprove()}
                  className="nb-btn nb-btn-pill w-full !py-2.5 !text-sm"
                >
                  Approve anyway
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void onApprove()}
                className="nb-btn nb-btn-red nb-btn-pill w-full !py-2.5 !text-sm"
              >
                {approved ? "Draft reply" : "Approve & draft reply"}
              </button>
            )}
          </div>
        )}
      </div>

      <DraftReplyModal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        to={enquiry.from}
        subject={enquiry.subject}
        body={replyBody}
      />
    </main>
  );
}
