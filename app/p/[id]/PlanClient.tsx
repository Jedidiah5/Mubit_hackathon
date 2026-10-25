"use client";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QuoteCard } from "@/components/enquiry/QuoteCard";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { applyOverrides, layout } from "@/lib/layout";
import { formatGbp, quote } from "@/lib/quote";
import {
  EXTRAS,
  STYLES,
  WALLS,
  pipelineOf,
  type Extra,
  type Enquiry,
  type LayoutOverride,
  type Spec,
  type Style,
  type Wall,
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
  const [draft, setDraft] = useState<Spec | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  const pipeline = enquiry ? pipelineOf(enquiry) : null;
  const accepted = pipeline === "accepted";

  const feasibility = useMemo(() => {
    if (!spec) return null;
    return evaluateRooms(rooms, spec, roomOverride);
  }, [rooms, spec, roomOverride]);

  const room = feasibility?.room ?? rooms[0] ?? DEMO_ROOMS[0]!;

  const pendingOverrides =
    enquiry?.changeRequest?.status === "pending"
      ? (enquiry.changeRequest.overrides ?? EMPTY_OVERRIDES)
      : EMPTY_OVERRIDES;

  const items = useMemo(() => {
    if (!spec || !feasibility?.room) return [];
    return applyOverrides(layout(feasibility.room, spec), {
      ...(enquiry?.final?.overrides ?? {}),
      ...pendingOverrides,
    });
  }, [spec, feasibility, enquiry?.final?.overrides, pendingOverrides]);

  const onLayoutOverridesChange = useCallback(
    async (next: Record<string, LayoutOverride>) => {
      if (!spec || accepted) return;
      const prev =
        enquiry?.changeRequest?.status === "pending"
          ? enquiry.changeRequest
          : null;
      await updateDoc(doc(getDb(), "enquiries", id), {
        changeRequest: {
          status: "pending",
          spec: prev?.spec ?? spec,
          note: prev?.note ?? null,
          overrides: next,
          at: new Date().toISOString(),
        },
        status: "client_changes",
      });
    },
    [accepted, enquiry?.changeRequest, id, spec],
  );

  const liveQuote = useMemo(() => {
    if (!spec || !feasibility?.room?.pricing) return null;
    const named = rooms.find((r) => r.name === feasibility.room!.name);
    const priced = named?.pricing ? named : feasibility.room;
    return quote(priced, spec);
  }, [spec, feasibility, rooms]);

  const included = useMemo(() => {
    if (!spec) return [] as string[];
    const chips: string[] = [];
    for (const e of spec.extras) chips.push(EXTRA_LABEL[e] ?? e);
    if (spec.accessible) chips.push("Accessible route");
    if (spec.stage !== "none") chips.push(`Stage (${spec.stage})`);
    if (spec.bar !== "none") chips.push(`Bar (${spec.bar})`);
    return chips;
  }, [spec]);

  function openAdjust() {
    if (!spec) return;
    setDraft({ ...spec, extras: [...spec.extras] });
    setNote("");
    setSaveError(null);
    setAdjustOpen(true);
  }

  async function submitChanges() {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(getDb(), "enquiries", id), {
        changeRequest: {
          status: "pending",
          spec: draft,
          note: note.trim() || null,
          overrides:
            enquiry?.changeRequest?.status === "pending"
              ? enquiry.changeRequest.overrides
              : undefined,
          at: new Date().toISOString(),
        },
        status: "client_changes",
      });
      setAdjustOpen(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not send changes",
      );
    } finally {
      setSaving(false);
    }
  }

  async function acceptHold() {
    if (saving || accepted) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(getDb(), "enquiries", id), {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not accept proposal",
      );
    } finally {
      setSaving(false);
    }
  }

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

  const dateLabel =
    formatDate(enquiry.eventDate) ??
    formatDate(enquiry.receivedAt)?.replace(/,.*/, "") ??
    "Date TBC";
  const hero = `${eventLabel(enquiry, spec)} · ${room.name} · ${dateLabel} · ${spec.guests} guests`;

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
          {pipeline === "client_changes" &&
            enquiry.changeRequest?.status === "pending" && (
              <p className="nb-chip nb-chip-yellow mt-3">
                Change request sent — waiting on the venue
              </p>
            )}
        </header>

        {accepted ? (
          <div className="nb-banner nb-banner-ok mt-5 px-5 py-8 text-center">
            <p className="font-sans text-2xl font-bold tracking-tight text-[color:var(--fits)]">
              Date held
            </p>
            <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
              The venue will confirm shortly
            </p>
          </div>
        ) : null}

        <div className="nb-panel relative mt-5 aspect-[4/3] w-full overflow-hidden !p-0 sm:aspect-[16/10]">
          <RoomCanvas
            room={room}
            items={items}
            spec={spec}
            layoutEdit={
              accepted
                ? undefined
                : {
                    overrides: pendingOverrides,
                    onOverridesChange: onLayoutOverridesChange,
                  }
            }
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

          {!accepted && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openAdjust}
                disabled={saving}
                className="nb-btn nb-btn-blue nb-btn-pill flex-1"
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => void acceptHold()}
                disabled={saving}
                className="nb-btn nb-btn-red nb-btn-pill flex-1"
              >
                Accept & hold the date
              </button>
            </div>
          )}
        </div>
      </div>

      {adjustOpen && draft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/50 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal
          aria-label="Request changes"
        >
          <div className="nb-frame max-h-[92vh] w-full max-w-md overflow-y-auto !rounded-b-none p-5 sm:max-h-[85vh] sm:!rounded-[var(--radius)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Request changes
              </p>
              <button
                type="button"
                onClick={() => setAdjustOpen(false)}
                className="nb-chip"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="nb-label">Layout</span>
                <select
                  className="nb-input"
                  value={draft.style}
                  onChange={(e) =>
                    setDraft({ ...draft, style: e.target.value as Style })
                  }
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="nb-label">Guests</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="nb-btn !min-h-0 !w-auto px-3 py-2"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        guests: Math.max(1, draft.guests - 5),
                      })
                    }
                  >
                    −5
                  </button>
                  <span className="min-w-[3rem] text-center font-sans text-xl font-bold tabular-nums">
                    {draft.guests}
                  </span>
                  <button
                    type="button"
                    className="nb-btn !min-h-0 !w-auto px-3 py-2"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        guests: Math.min(1000, draft.guests + 5),
                      })
                    }
                  >
                    +5
                  </button>
                </div>
              </div>

              <div>
                <span className="nb-label">Extras</span>
                <div className="flex flex-wrap gap-2">
                  {EXTRAS.map((extra) => {
                    const on = draft.extras.includes(extra);
                    return (
                      <button
                        key={extra}
                        type="button"
                        onClick={() => {
                          const extras = on
                            ? draft.extras.filter((x) => x !== extra)
                            : [...draft.extras, extra];
                          setDraft({ ...draft, extras });
                        }}
                        className={`nb-chip ${on ? "nb-chip-teal" : ""}`}
                      >
                        {EXTRA_LABEL[extra]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="nb-label">Stage wall</span>
                  <select
                    className="nb-input"
                    value={draft.stage}
                    onChange={(e) =>
                      setDraft({ ...draft, stage: e.target.value as Wall })
                    }
                  >
                    {WALLS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="nb-label">Bar wall</span>
                  <select
                    className="nb-input"
                    value={draft.bar}
                    onChange={(e) =>
                      setDraft({ ...draft, bar: e.target.value as Wall })
                    }
                  >
                    {WALLS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 font-mono text-[12px] font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-[color:var(--ink)]"
                  checked={draft.accessible}
                  onChange={(e) =>
                    setDraft({ ...draft, accessible: e.target.checked })
                  }
                />
                Accessible route
              </label>

              <label className="block">
                <span className="nb-label">Note to the venue</span>
                <textarea
                  rows={3}
                  className="nb-input resize-y"
                  placeholder="Anything else we should know…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void submitChanges()}
              className="nb-btn nb-btn-ink mt-5 w-full"
            >
              {saving ? "Sending…" : "Send change request"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
