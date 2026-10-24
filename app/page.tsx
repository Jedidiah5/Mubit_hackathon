"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { PasteEnquiryModal } from "@/components/inbox/PasteEnquiryModal";
import { StatusChip } from "@/components/inbox/StatusChip";
import { evaluateRooms } from "@/lib/evaluate";
import { firestoreFeasibility } from "@/lib/feasibility-serialize";
import { getDb } from "@/lib/firebase";
import { formatGbp, quote } from "@/lib/quote";
import type {
  EnquiryListItem,
  FeasibilityStatus,
  Room,
  Spec,
} from "@/lib/types";
import { useVenueRooms } from "@/lib/useVenueRooms";

function asIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date(0).toISOString();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function senderName(from: string): string {
  const name = from.split("<")[0]?.trim();
  return name || from;
}

function guestsOf(row: EnquiryListItem): number | null {
  const spec: Spec | undefined = row.final ?? row.parsed;
  return spec?.guests ?? null;
}

function estTotalOf(row: EnquiryListItem, rooms: Room[]): string | null {
  const spec: Spec | undefined = row.final ?? row.parsed;
  if (!spec || !row.status) return null;
  const name = row.feasibility?.room?.name;
  const fromList = name ? rooms.find((r) => r.name === name) : undefined;
  const room =
    fromList?.pricing
      ? fromList
      : row.feasibility?.room?.pricing
        ? row.feasibility.room
        : null;
  if (!room) return null;
  return formatGbp(quote(room, spec).total);
}

type ParseResponse = {
  spec: Spec;
  requestId: string | null;
  latencyMs: number;
  model: string;
  notesUsed: number;
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function InboxPage() {
  const rooms = useVenueRooms();
  const [rows, setRows] = useState<EnquiryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(getDb(), "enquiries"),
      orderBy("receivedAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: EnquiryListItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            from: String(data.from ?? ""),
            subject: String(data.subject ?? ""),
            body: String(data.body ?? ""),
            receivedAt: asIso(data.receivedAt),
            parsed: data.parsed as Spec | undefined,
            final: data.final as Spec | undefined,
            status: data.status as FeasibilityStatus | undefined,
            requestId: data.requestId as string | undefined,
            latencyMs: data.latencyMs as number | undefined,
            model: data.model as string | undefined,
            feasibility: data.feasibility,
          };
        });
        setRows(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const unprocessed = useMemo(
    () => rows.filter((r) => !r.parsed),
    [rows],
  );

  const countLabel = useMemo(() => {
    if (loading) return "Loading…";
    const pending = unprocessed.length;
    return `${rows.length} enquir${rows.length === 1 ? "y" : "ies"}${
      pending ? ` · ${pending} unprocessed` : ""
    }`;
  }, [loading, rows.length, unprocessed.length]);

  const processAll = useCallback(async () => {
    const queue = rows.filter((r) => !r.parsed);
    if (queue.length === 0 || processing) return;
    setProcessing(true);
    setError(null);

    for (let i = 0; i < queue.length; i++) {
      const row = queue[i]!;
      setProcessProgress(`Parsing ${i + 1}/${queue.length}: ${row.subject}`);
      const started = Date.now();
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: row.body, enquiryId: row.id }),
        });
        const data = (await res.json()) as ParseResponse;
        if (!res.ok) {
          throw new Error(data.error ?? `Parse failed (${res.status})`);
        }
        const feasibility = evaluateRooms(rooms, data.spec, null);
        await updateDoc(doc(getDb(), "enquiries", row.id), {
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
      } catch (err) {
        setError(
          err instanceof Error
            ? `${row.subject}: ${err.message}`
            : "Process all failed",
        );
      }
      const elapsed = Date.now() - started;
      if (i < queue.length - 1 && elapsed < 1000) {
        await sleep(1000 - elapsed);
      }
    }

    setProcessing(false);
    setProcessProgress(null);
  }, [rows, rooms, processing]);

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--line)] pb-6">
          <div className="space-y-4">
            <AppNav current="/" />
            <div>
              <h1 className="font-sans text-3xl tracking-tight sm:text-4xl">
                Inbox
              </h1>
              <p className="mt-2 font-mono text-xs text-[color:var(--muted)]">
                The Wharf Rooms · {countLabel}
              </p>
              {processProgress && (
                <p className="mt-1 font-mono text-[11px] text-[color:var(--warning)]">
                  {processProgress}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void processAll()}
              disabled={processing || unprocessed.length === 0}
              className="border border-[color:var(--ink)] px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--ink)] transition hover:bg-[color:var(--panel)] disabled:opacity-40"
            >
              {processing
                ? "Processing…"
                : `Process all${unprocessed.length ? ` (${unprocessed.length})` : ""}`}
            </button>
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="bg-[color:var(--ink)] px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] transition hover:opacity-90"
            >
              Paste new enquiry
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-6 border border-[color:var(--cannot)]/40 bg-[color:var(--cannot)]/10 px-4 py-3 font-mono text-xs text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <div className="mb-3 hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_4rem_8.5rem_6.5rem_7rem] gap-4 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)] md:grid">
          <span>From</span>
          <span>Subject</span>
          <span className="text-right">Guests</span>
          <span>Status</span>
          <span className="text-right">Est. total</span>
          <span className="text-right">Received</span>
        </div>

        <ul className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)] bg-[color:var(--panel)]/60">
          {loading && rows.length === 0 && (
            <li className="px-3 py-10 font-mono text-sm text-[color:var(--muted)]">
              Listening for enquiries…
            </li>
          )}
          {!loading && rows.length === 0 && !error && (
            <li className="px-3 py-10 font-mono text-sm text-[color:var(--muted)]">
              Inbox empty. Seed with{" "}
              <code className="text-[color:var(--ink)]">npm run seed:inbox</code> or
              paste a new enquiry.
            </li>
          )}
          {rows.map((row) => {
            const guests = guestsOf(row);
            const est = estTotalOf(row, rooms);
            return (
              <li key={row.id}>
                <Link
                  href={`/enquiry/${row.id}`}
                  className="grid grid-cols-1 gap-2 px-3 py-4 transition hover:bg-[color:var(--panel-2)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_4rem_8.5rem_6.5rem_7rem] md:items-center md:gap-4"
                >
                  <span className="truncate font-sans text-sm">
                    {senderName(row.from)}
                  </span>
                  <span className="truncate text-sm text-[color:var(--muted)]">
                    {row.subject}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[color:var(--muted)] md:text-right">
                    {guests == null ? "—" : guests}
                  </span>
                  <span>
                    <StatusChip
                      status={row.status}
                      used={row.feasibility?.used}
                      capacity={row.feasibility?.capacity}
                    />
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[color:var(--ink)] md:text-right">
                    {est ?? "—"}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--muted)] md:text-right">
                    {formatWhen(row.receivedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <PasteEnquiryModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
      />
    </main>
  );
}
