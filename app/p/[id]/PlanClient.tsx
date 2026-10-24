"use client";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QuoteCard } from "@/components/enquiry/QuoteCard";
import { DEMO_ROOMS } from "@/lib/data/venue";
import { evaluateRooms } from "@/lib/evaluate";
import { getDb } from "@/lib/firebase";
import { layout } from "@/lib/layout";
import { formatGbp, quote } from "@/lib/quote";
import {
  EXTRAS,
  STYLES,
  WALLS,
  pipelineOf,
  type Extra,
  type Enquiry,
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

const fieldClass =
  "w-full border border-[color:var(--line)] bg-[color:var(--panel)] px-2.5 py-2 font-mono text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--ink)]";
const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]";

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
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-16 pt-6 sm:px-6">
        <header className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
              The Wharf Rooms · proposal
            </p>
            <Link
              href={`/e/${id}`}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)] underline-offset-4 hover:underline"
            >
              ← Status
            </Link>
          </div>
          <h1 className="mt-2 font-sans text-xl tracking-tight sm:text-2xl">
            {hero}
          </h1>
          {pipeline === "client_changes" &&
            enquiry.changeRequest?.status === "pending" && (
              <p className="mt-2 font-mono text-[11px] text-[color:var(--warning)]">
                Change request sent — waiting on the venue
              </p>
            )}
        </header>

        {accepted ? (
          <div className="mt-8 border border-[color:var(--fits)]/35 bg-[color:var(--fits)]/10 px-5 py-8 text-center">
            <p className="font-sans text-2xl tracking-tight text-[color:var(--fits)]">
              Date held
            </p>
            <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
              The venue will confirm shortly
            </p>
          </div>
        ) : null}

        <div className="relative mt-6 aspect-[4/3] w-full overflow-hidden border border-[color:var(--line)] sm:aspect-[16/10]">
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

        <div className="mt-6 space-y-6">
          {liveQuote && (
            <QuoteCard quote={liveQuote} roomName={room.name} />
          )}

          {included.length > 0 && (
            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Included
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {included.map((chip) => (
                  <span
                    key={chip}
                    className="border border-[color:var(--line)] bg-[color:var(--panel)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}

          {saveError && (
            <p className="font-mono text-xs text-[color:var(--cannot)]">
              {saveError}
            </p>
          )}

          {!accepted && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openAdjust}
                disabled={saving}
                className="flex-1 border border-[color:var(--ink)] px-4 py-3.5 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--ink)] disabled:opacity-50"
              >
                Request changes
              </button>
              <button
                type="button"
                onClick={() => void acceptHold()}
                disabled={saving}
                className="flex-1 bg-[color:var(--ink)] px-4 py-3.5 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] disabled:opacity-50"
              >
                Accept & hold the date
              </button>
            </div>
          )}
        </div>
      </div>

      {adjustOpen && draft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 sm:items-center sm:p-6"
          role="dialog"
          aria-modal
          aria-label="Request changes"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-[color:var(--line)] bg-[color:var(--background)] p-5 shadow-lg sm:max-h-[85vh]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Request changes
              </p>
              <button
                type="button"
                onClick={() => setAdjustOpen(false)}
                className="font-mono text-[11px] text-[color:var(--muted)]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className={labelClass}>Layout</span>
                <select
                  className={fieldClass}
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
                <span className={labelClass}>Guests</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="border border-[color:var(--line)] px-3 py-2 font-mono text-sm"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        guests: Math.max(1, draft.guests - 5),
                      })
                    }
                  >
                    −5
                  </button>
                  <span className="min-w-[3rem] text-center font-sans text-xl tabular-nums">
                    {draft.guests}
                  </span>
                  <button
                    type="button"
                    className="border border-[color:var(--line)] px-3 py-2 font-mono text-sm"
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
                <span className={labelClass}>Extras</span>
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
                        className={`border px-2.5 py-1.5 font-mono text-[11px] ${
                          on
                            ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--panel-2)]"
                            : "border-[color:var(--line)] text-[color:var(--muted)]"
                        }`}
                      >
                        {EXTRA_LABEL[extra]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Stage wall</span>
                  <select
                    className={fieldClass}
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
                  <span className={labelClass}>Bar wall</span>
                  <select
                    className={fieldClass}
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

              <label className="flex items-center gap-2 font-mono text-[12px]">
                <input
                  type="checkbox"
                  checked={draft.accessible}
                  onChange={(e) =>
                    setDraft({ ...draft, accessible: e.target.checked })
                  }
                />
                Accessible route
              </label>

              <label className="block">
                <span className={labelClass}>Note to the venue</span>
                <textarea
                  rows={3}
                  className={`${fieldClass} resize-y`}
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
              className="mt-5 w-full bg-[color:var(--ink)] px-4 py-3.5 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send change request"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
