"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PasteEnquiryModal } from "@/components/inbox/PasteEnquiryModal";
import { StatusChip } from "@/components/inbox/StatusChip";
import { getDb } from "@/lib/firebase";
import type { EnquiryListItem, FeasibilityStatus, Spec } from "@/lib/types";

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

export default function InboxPage() {
  const [rows, setRows] = useState<EnquiryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);

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

  const countLabel = useMemo(() => {
    if (loading) return "Loading…";
    return `${rows.length} enquir${rows.length === 1 ? "y" : "ies"}`;
  }, [loading, rows.length]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f4efe6]">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-[#f4efe6]/12 pb-6">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
              BriefToFloor
            </p>
            <h1 className="font-sans text-3xl tracking-tight sm:text-4xl">
              Inbox
            </h1>
            <p className="mt-2 font-mono text-xs text-[#f4efe6]/45">
              The Wharf Rooms · {countLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="bg-[#c8ff00] px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[#0a0a0a] transition hover:brightness-110"
          >
            Paste new enquiry
          </button>
        </header>

        {error && (
          <p className="mb-6 border border-[#f87171]/40 bg-[#f87171]/10 px-4 py-3 font-mono text-xs text-[#f87171]">
            Firestore: {error}
          </p>
        )}

        <div className="mb-3 hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_4.5rem_9rem_7rem] gap-4 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6]/35 md:grid">
          <span>From</span>
          <span>Subject</span>
          <span className="text-right">Guests</span>
          <span>Status</span>
          <span className="text-right">Received</span>
        </div>

        <ul className="divide-y divide-[#f4efe6]/10 border-y border-[#f4efe6]/12">
          {loading && rows.length === 0 && (
            <li className="px-3 py-10 font-mono text-sm text-[#f4efe6]/40">
              Listening for enquiries…
            </li>
          )}
          {!loading && rows.length === 0 && !error && (
            <li className="px-3 py-10 font-mono text-sm text-[#f4efe6]/40">
              Inbox empty. Seed with{" "}
              <code className="text-[#c8ff00]">npm run seed:inbox</code> or
              paste a new enquiry.
            </li>
          )}
          {rows.map((row) => {
            const guests = guestsOf(row);
            return (
              <li key={row.id}>
                <Link
                  href={`/enquiry/${row.id}`}
                  className="grid grid-cols-1 gap-2 px-3 py-4 transition hover:bg-[#f4efe6]/04 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_4.5rem_9rem_7rem] md:items-center md:gap-4"
                >
                  <span className="truncate font-sans text-sm">
                    {senderName(row.from)}
                  </span>
                  <span className="truncate text-sm text-[#f4efe6]/75">
                    {row.subject}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[#f4efe6]/70 md:text-right">
                    {guests == null ? "—" : guests}
                  </span>
                  <span>
                    <StatusChip status={row.status} />
                  </span>
                  <span className="font-mono text-[11px] text-[#f4efe6]/40 md:text-right">
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
