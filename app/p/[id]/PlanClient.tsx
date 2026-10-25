"use client";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QuoteCard } from "@/components/enquiry/QuoteCard";
import { SpecForm } from "@/components/enquiry/SpecForm";
import { diffSpec } from "@/lib/corrections";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { applyOverrides, layout } from "@/lib/layout";
import { formatGbp, quote } from "@/lib/quote";
import {
  pipelineOf,
  type Extra,
  type Enquiry,
  type LayoutOverride,
  type Spec,
} from "@/lib/types";
import { useVenueRooms } from "@/lib/useVenueRooms";

const RoomCanvas = dynamic(
  () => import("@/components/scene").then((m) => m.RoomCanvas),
  { ssr: false },
);

const EXTRA_LABEL: Record<Extra, string> = {
  dance_floor: "Dance floor",
  dj_booth: "DJ booth",
  projector: "Projector",
  lectern: "Lectern",
  buffet: "Buffet",
  photo_booth: "Photo booth",
};

const EMPTY_OVERRIDES: Record<string, LayoutOverride> = {};

function asSpec(s: Spec): Spec {
  return {
    style: s.style,
    guests: s.guests,
    stage: s.stage,
    bar: s.bar,
    extras: [...s.extras],
    accessible: s.accessible,
  };
}

function overridesEqual(
  a: Record<string, LayoutOverride>,
  b: Record<string, LayoutOverride>,
): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    const ka = keysA[i]!;
    const pa = a[ka]!;
    const pb = b[ka]!;
    if (pa.x !== pb.x || pa.z !== pb.z || pa.rotY !== pb.rotY) return false;
  }
  return true;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function eventLabel(enquiry: Enquiry, spec: Spec): string {
  if (enquiry.eventType) return enquiry.eventType;
  const sub = enquiry.subject.replace(/\s*enquiry\s*$/i, "").trim();
  if (sub) return sub;
  return spec.style[0]!.toUpperCase() + spec.style.slice(1);
}

export function PlanClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const rooms = useVenueRooms();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [draftSpec, setDraftSpec] = useState<Spec | null>(null);
  const [draftOverrides, setDraftOverrides] =
    useState<Record<string, LayoutOverride>>(EMPTY_OVERRIDES);
  const [guestsDraft, setGuestsDraft] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askInfo, setAskInfo] = useState<string | null>(null);

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

  const approvedSpec: Spec | undefined = enquiry?.final ?? enquiry?.parsed;
  const approvedOverrides = enquiry?.final?.overrides ?? EMPTY_OVERRIDES;
  const roomOverride = enquiry?.roomOverride ?? null;
  const pipeline = enquiry ? pipelineOf(enquiry) : null;
  const confirmed = pipeline === "confirmed";
  const pending =
    enquiry?.changeRequest?.status === "pending"
      ? enquiry.changeRequest
      : null;

  // When the venue accepts (or dismisses), drop local adjust UI.
  useEffect(() => {
    if (!enquiry) return;
    if (enquiry.changeRequest?.status === "pending") return;
    if (adjustOpen) return;
    setJustSent(false);
  }, [enquiry, adjustOpen]);

  const liveSpec = adjustOpen && draftSpec ? draftSpec : approvedSpec;
  const liveOverrides =
    adjustOpen && draftSpec ? draftOverrides : approvedOverrides;

  const feasibility = useMemo(() => {
    if (!liveSpec) return null;
    return evaluateRooms(rooms, liveSpec, roomOverride);
  }, [rooms, liveSpec, roomOverride]);

  const room = feasibility?.room ?? rooms[0] ?? DEMO_ROOMS[0]!;

  const items = useMemo(() => {
    if (!liveSpec || !feasibility?.room) return [];
    return applyOverrides(
      layout(feasibility.room, liveSpec),
      liveOverrides,
    );
  }, [liveSpec, feasibility, liveOverrides]);

  const liveQuote = useMemo(() => {
    if (!liveSpec || !feasibility?.room?.pricing) return null;
    const named = rooms.find((r) => r.name === feasibility.room!.name);
    const priced = named?.pricing ? named : feasibility.room;
    return quote(priced, liveSpec);
  }, [liveSpec, feasibility, rooms]);

  const included = useMemo(() => {
    if (!liveSpec) return [] as string[];
    const chips: string[] = [];
    for (const e of liveSpec.extras) chips.push(EXTRA_LABEL[e] ?? e);
    if (liveSpec.accessible) chips.push("Accessible route");
    if (liveSpec.stage !== "none") chips.push(`Stage (${liveSpec.stage})`);
    if (liveSpec.bar !== "none") chips.push(`Bar (${liveSpec.bar})`);
    return chips;
  }, [liveSpec]);

  const specDiff = useMemo(() => {
    if (!approvedSpec || !draftSpec) return [];
    return diffSpec(approvedSpec, draftSpec);
  }, [approvedSpec, draftSpec]);

  const overridesDirty = useMemo(
    () => !overridesEqual(draftOverrides, approvedOverrides),
    [draftOverrides, approvedOverrides],
  );

  const noteDirty = note.trim().length > 0;
  const hasChanges =
    specDiff.length > 0 || overridesDirty || noteDirty;

  const openAdjust = useCallback(() => {
    if (!approvedSpec) return;
    // Seed from a pending request if one exists, else the approved plan.
    const seedSpec = pending ? asSpec(pending.spec) : asSpec(approvedSpec);
    const seedOverrides = pending?.overrides
      ? { ...pending.overrides }
      : { ...approvedOverrides };
    setDraftSpec(seedSpec);
    setDraftOverrides(seedOverrides);
    setGuestsDraft(String(seedSpec.guests));
    setNote(pending?.note ?? "");
    setSaveError(null);
    setJustSent(false);
    setAdjustOpen(true);
  }, [approvedSpec, approvedOverrides, pending]);

  const closeAdjust = useCallback(() => {
    setAdjustOpen(false);
    setDraftSpec(null);
    setDraftOverrides(EMPTY_OVERRIDES);
    setNote("");
    setSaveError(null);
  }, []);

  const onDraftChange = useCallback(
    <K extends keyof Spec>(field: K, value: Spec[K]) => {
      setDraftSpec((prev) => (prev ? { ...prev, [field]: value } : prev));
      if (field === "guests" && typeof value === "number") {
        setGuestsDraft(String(value));
      }
    },
    [],
  );

  const onGuestsDraft = useCallback((value: string) => {
    setGuestsDraft(value);
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1 || n > 1000) return;
    setDraftSpec((prev) => (prev ? { ...prev, guests: n } : prev));
  }, []);

  const onLayoutOverridesChange = useCallback(
    (next: Record<string, LayoutOverride>) => {
      // Local draft only — Firestore stays unchanged until Send.
      setDraftOverrides(next);
    },
    [],
  );

  async function submitChanges() {
    if (!draftSpec || !approvedSpec || saving || !hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      const diff = diffSpec(approvedSpec, draftSpec);
      await updateDoc(doc(getDb(), "enquiries", id), {
        changeRequest: {
          status: "pending",
          spec: asSpec(draftSpec),
          note: note.trim() || null,
          overrides: overridesDirty ? draftOverrides : undefined,
          diff,
          source: "adjust",
          at: new Date().toISOString(),
        },
        status: "client_changes",
      });
      setJustSent(true);
      setAdjustOpen(false);
      setDraftSpec(null);
      setDraftOverrides(EMPTY_OVERRIDES);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not send changes",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmBooking() {
    if (saving || confirmed || pending) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(getDb(), "enquiries", id), {
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
      });
      closeAdjust();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not confirm booking",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitAsk() {
    const question = askText.trim();
    if (!question || asking || confirmed || pending) return;
    setAsking(true);
    setAskError(null);
    setAskInfo(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId: id, question }),
      });
      const data = (await res.json()) as {
        error?: string;
        unchanged?: boolean;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Ask failed (${res.status})`);
      }
      if (data.unchanged) {
        setAskInfo(data.message ?? "Nothing in the plan needed to change.");
      } else {
        setAskText("");
        setJustSent(true);
        setAskInfo("Sent to the venue as a change request — nothing applied yet.");
      }
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Ask the venue failed");
    } finally {
      setAsking(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-8">
        <p className="font-mono text-sm text-[color:var(--cannot)]">{error}</p>
      </main>
    );
  }

  if (!enquiry || !approvedSpec || !liveSpec) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-8">
        <p className="font-mono text-sm text-[color:var(--muted)]">
          {!enquiry ? "Loading floor plan…" : "No layout yet for this enquiry."}
        </p>
      </main>
    );
  }

  const dateLabel =
    formatDate(enquiry.eventDate) ??
    formatDate(enquiry.receivedAt)?.replace(/,.*/, "") ??
    "Date TBC";
  const hero = `${eventLabel(enquiry, liveSpec)} · ${room.name} · ${dateLabel} · ${liveSpec.guests} guests`;
  const showPending = Boolean(pending) || justSent;

  return (
    <main className="min-h-screen text-[color:var(--ink)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
        <header className="nb-frame nb-frame-red shrink-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              The Wharf Rooms · proposal
            </p>
            <Link href={`/e/${id}`} className="nb-chip nb-chip-yellow">
              ← Status
            </Link>
          </div>
          <h1 className="mt-3 font-sans text-xl font-extrabold tracking-tight sm:text-2xl">
            {hero}
          </h1>
          {confirmed && (
            <p className="nb-chip nb-chip-teal mt-3">Booking confirmed</p>
          )}
          {showPending && !confirmed && (
            <p className="nb-chip nb-chip-yellow mt-3">
              Pending venue review
            </p>
          )}
        </header>

        {confirmed ? (
          <div className="nb-banner nb-banner-ok mt-5 px-5 py-8 text-center">
            <p className="font-sans text-2xl font-bold tracking-tight text-[color:var(--fits)]">
              Booking confirmed
            </p>
            <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
              The venue will be in touch
            </p>
            {liveQuote && (
              <p className="mt-4 font-sans text-lg font-extrabold tabular-nums text-[color:var(--ink)]">
                {formatGbp(liveQuote.total)}{" "}
                <span className="font-mono text-[11px] font-bold text-[color:var(--muted)]">
                  inc. VAT
                </span>
              </p>
            )}
            <p className="mt-2 font-mono text-[11px] text-[color:var(--muted)]">
              {liveSpec.style[0]!.toUpperCase()}
              {liveSpec.style.slice(1)} · {liveSpec.guests} guests · {room.name}
            </p>
          </div>
        ) : null}

        {(justSent || (pending && !adjustOpen)) && !confirmed && (
          <div className="nb-banner nb-banner-ok mt-5 px-4 py-3 font-mono text-[12px] font-bold text-[color:var(--fits)]">
            Sent — the venue will review your changes
          </div>
        )}

        {enquiry.changeRequest?.status === "dismissed" &&
          enquiry.changeRequest.replyNote?.trim() &&
          !confirmed && (
            <div className="nb-banner nb-banner-warn mt-5 px-4 py-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--warning)]">
                Venue reply
              </p>
              <p className="mt-1 font-mono text-[12px] font-bold leading-relaxed text-[color:var(--ink)]">
                “{enquiry.changeRequest.replyNote.trim()}”
              </p>
            </div>
          )}

        <div className="nb-panel relative mt-5 aspect-[4/3] w-full overflow-hidden !p-0 sm:aspect-[16/10]">
          <RoomCanvas
            room={room}
            items={items}
            spec={liveSpec}
            layoutEdit={
              confirmed || !adjustOpen
                ? undefined
                : {
                    overrides: draftOverrides,
                    onOverridesChange: onLayoutOverridesChange,
                  }
            }
            hud={{
              subtitle: `${liveSpec.style[0]!.toUpperCase()}${liveSpec.style.slice(1)} · ${liveSpec.guests} guests`,
              status: feasibility?.status,
              used: feasibility?.used,
              capacity: feasibility?.capacity,
              footnote: liveQuote
                ? `Estimated total ${formatGbp(liveQuote.total)} inc. VAT`
                : undefined,
            }}
          />
        </div>

        <div className="mt-5 space-y-5">
          {liveQuote && <QuoteCard quote={liveQuote} roomName={room.name} />}

          {included.length > 0 && (
            <section className="nb-panel nb-panel-lilac p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Included
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {included.map((chip) => (
                  <span key={chip} className="nb-chip">
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}

          {saveError && (
            <p className="nb-banner nb-banner-bad font-mono text-xs font-bold text-[color:var(--cannot)]">
              {saveError}
            </p>
          )}

          {!confirmed && !adjustOpen && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openAdjust}
                disabled={saving || asking}
                className="nb-btn nb-btn-blue nb-btn-pill flex-1"
              >
                Adjust your event
              </button>
              <button
                type="button"
                onClick={() => void confirmBooking()}
                disabled={saving || asking || Boolean(pending)}
                className="nb-btn nb-btn-red nb-btn-pill flex-1"
                title={
                  pending
                    ? "Wait for the venue to review your change request"
                    : undefined
                }
              >
                Confirm booking
              </button>
            </div>
          )}

          {!confirmed && (
            <section className="nb-panel p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Ask the venue
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-[color:var(--muted)]">
                Describe a change in plain English. We&apos;ll draft an updated
                plan for the venue to approve — nothing changes until they do.
              </p>
              <textarea
                rows={3}
                className="nb-input mt-3 resize-y"
                placeholder="e.g. Can we drop the dance floor and seat 140 instead?"
                value={askText}
                disabled={asking || Boolean(pending)}
                onChange={(e) => setAskText(e.target.value)}
              />
              {askError && (
                <p className="mt-2 font-mono text-[11px] font-bold text-[color:var(--cannot)]">
                  {askError}
                </p>
              )}
              {askInfo && !askError && (
                <p className="mt-2 font-mono text-[11px] font-bold text-[color:var(--fits)]">
                  {askInfo}
                </p>
              )}
              <button
                type="button"
                className="nb-btn nb-btn-ink mt-3 w-full"
                disabled={
                  asking ||
                  Boolean(pending) ||
                  askText.trim().length === 0
                }
                onClick={() => void submitAsk()}
              >
                {asking
                  ? "Asking…"
                  : pending
                    ? "Waiting on venue…"
                    : "Send question"}
              </button>
            </section>
          )}

          {!confirmed && adjustOpen && draftSpec && (
            <section className="nb-frame nb-frame-blue space-y-5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Adjust your event
                </p>
                <button
                  type="button"
                  onClick={closeAdjust}
                  className="nb-chip"
                >
                  Cancel
                </button>
              </div>

              <p className="font-mono text-[11px] leading-relaxed text-[color:var(--muted)]">
                Preview updates live below. Use <strong>Edit layout</strong> on
                the plan to move furniture. Nothing is sent until you confirm.
              </p>

              <SpecForm
                variant="client"
                spec={draftSpec}
                onChange={onDraftChange}
                guestsDraft={guestsDraft}
                onGuestsDraft={onGuestsDraft}
                note={note}
                onNoteChange={setNote}
              />

              <button
                type="button"
                disabled={saving || !hasChanges}
                onClick={() => void submitChanges()}
                className="nb-btn nb-btn-ink w-full"
              >
                {saving
                  ? "Sending…"
                  : hasChanges
                    ? "Send changes to venue"
                    : "No changes yet"}
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
