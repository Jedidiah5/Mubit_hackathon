"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PasteEnquiryModal } from "@/components/inbox/PasteEnquiryModal";
import { ReviewTag } from "@/components/inbox/ReviewTag";
import { StatusChip } from "@/components/inbox/StatusChip";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { evaluateRooms } from "@/lib/evaluate";
import { enquiryText, missingDetails, needsInfo } from "@/lib/missing";
import { getDb } from "@/lib/firebase";
import { formatGbp, quote } from "@/lib/quote";
import {
  pipelineOf,
  type EnquiryListItem,
  type Feasibility,
  type PipelineStatus,
  type Room,
  type Spec,
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

/** Same live check as the enquiry page — never trust a stored status chip. */
function liveFeasibility(
  row: EnquiryListItem,
  rooms: Room[],
): Feasibility | null {
  const spec: Spec | undefined = row.final ?? row.parsed;
  if (!spec || rooms.length === 0) return null;
  return evaluateRooms(rooms, spec, row.roomOverride ?? null);
}

function estTotalOf(row: EnquiryListItem, rooms: Room[]): string | null {
  const spec: Spec | undefined = row.final ?? row.parsed;
  const feas = liveFeasibility(row, rooms);
  if (!spec || !feas?.room?.pricing) return null;
  return formatGbp(quote(feas.room, spec).total);
}

type Tab = PipelineStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: "received", label: "Received" },
  { id: "proposed", label: "Proposed" },
  { id: "client_changes", label: "Client changes" },
  { id: "confirmed", label: "Confirmed" },
];

const EMPTY: Record<Tab, string> = {
  received: "Nothing waiting. New form and email enquiries land here.",
  proposed: "No proposals out yet. Approve & draft reply to move one here.",
  client_changes: "No client tweak requests waiting.",
  confirmed:
    "No bookings confirmed yet. When a client confirms, they land here.",
};

const PIPELINE_META: Record<
  PipelineStatus,
  { label: string; color: string }
> = {
  received: { label: "Received", color: "var(--muted)" },
  proposed: { label: "Proposed", color: "var(--fits)" },
  client_changes: { label: "Client changes", color: "var(--warning)" },
  confirmed: { label: "Confirmed", color: "var(--accent-blue)" },
};

function PipelineChip({ status }: { status: PipelineStatus }) {
  const chip = PIPELINE_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]"
      style={{ color: chip.color }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: chip.color }}
        aria-hidden
      />
      {chip.label}
    </span>
  );
}

function pendingChangeKey(row: EnquiryListItem): string | null {
  const cr = row.changeRequest;
  if (!cr || cr.status !== "pending") return null;
  return `${row.id}:${cr.at ?? "pending"}`;
}

export default function InboxPage() {
  const rooms = useVenueRooms();
  const [rows, setRows] = useState<EnquiryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("received");
  const [origin, setOrigin] = useState("");
  /** Enquiry ids that just received a pending client change request. */
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());
  const seenPending = useRef<Set<string> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
            status: data.status,
            requestId: data.requestId as string | undefined,
            latencyMs: data.latencyMs as number | undefined,
            model: data.model as string | undefined,
            feasibility: data.feasibility,
            roomOverride: (data.roomOverride as string | null | undefined) ?? null,
            approvedAt: data.approvedAt as string | null | undefined,
            acceptedAt: data.acceptedAt as string | null | undefined,
            confirmedAt: data.confirmedAt as string | null | undefined,
            changeRequest: data.changeRequest,
            email: data.email as string | undefined,
            source: data.source,
            eventType: data.eventType as string | undefined,
            eventDate: data.eventDate as string | undefined,
          };
        });

        const pendingKeys = new Set(
          next
            .map(pendingChangeKey)
            .filter((k): k is string => Boolean(k)),
        );
        if (seenPending.current === null) {
          // First snapshot — seed without flashing (avoid animating on reload).
          seenPending.current = pendingKeys;
        } else {
          const fresh: string[] = [];
          for (const key of pendingKeys) {
            if (!seenPending.current.has(key)) {
              const enquiryId = key.split(":")[0]!;
              fresh.push(enquiryId);
            }
          }
          if (fresh.length > 0) {
            setFlashIds((prev) => {
              const n = new Set(prev);
              for (const id of fresh) n.add(id);
              return n;
            });
            // Auto-focus the Client changes tab for the demo beat.
            setTab("client_changes");
            window.setTimeout(() => {
              setFlashIds((prev) => {
                const n = new Set(prev);
                for (const id of fresh) n.delete(id);
                return n;
              });
            }, 2800);
          }
          seenPending.current = pendingKeys;
        }

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

  const byTab = useMemo(() => {
    const groups: Record<Tab, EnquiryListItem[]> = {
      received: [],
      proposed: [],
      client_changes: [],
      confirmed: [],
    };
    for (const row of rows) groups[pipelineOf(row)].push(row);
    return groups;
  }, [rows]);
  const visible = byTab[tab];

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
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? `Parse failed (${res.status})`);
        }
        // Server persists parsed + final when enquiryId is set.
      } catch (err) {
        setError(
          err instanceof Error
            ? `${row.subject}: ${err.message}`
            : "Process all failed",
        );
      }
      const elapsed = Date.now() - started;
      if (i < queue.length - 1 && elapsed < 1000) {
        await new Promise((r) => setTimeout(r, 1000 - elapsed));
      }
    }

    setProcessing(false);
    setProcessProgress(null);
  }, [rows, processing]);

  return (
    <PageShell>
        <PageHeader
          current="/"
          title="Inbox"
          subtitle={`The Wharf Rooms · ${countLabel}`}
          meta={
            <>
              {origin && (
                <p className="mt-2 break-all font-mono text-[11px] text-[color:var(--muted)]">
                  Enquiry form:{" "}
                  <span className="nb-chip nb-chip-yellow !normal-case tracking-normal">
                    {origin}/enquire
                  </span>
                </p>
              )}
              {processProgress && (
                <p className="mt-2 font-mono text-[11px] font-bold text-[color:var(--warning)]">
                  {processProgress}
                </p>
              )}
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => void processAll()}
                disabled={processing || unprocessed.length === 0}
                className="nb-btn"
              >
                {processing
                  ? "Processing…"
                  : `Process all${unprocessed.length ? ` (${unprocessed.length})` : ""}`}
              </button>
              <button
                type="button"
                onClick={() => setPasteOpen(true)}
                className="nb-btn nb-btn-red nb-btn-pill"
              >
                Paste new enquiry
              </button>
            </>
          }
        />

        {error && (
          <p className="nb-banner nb-banner-bad mb-6 font-mono text-xs font-bold text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <div role="tablist" className="nb-tablist mb-5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`nb-tab ${active ? "is-active" : ""}`}
              >
                {t.label}
                <span className="ml-1.5 tabular-nums opacity-70">
                  {loading ? "·" : byTab[t.id].length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-3 hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_4rem_minmax(7rem,1fr)_6.5rem_7rem] gap-4 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)] lg:grid">
          <span>From</span>
          <span>Subject</span>
          <span className="text-right">Guests</span>
          <span>Status</span>
          <span className="text-right">Est. total</span>
          <span className="text-right">Received</span>
        </div>

        <ul className="nb-frame nb-frame-snow divide-y-2 divide-[color:var(--ink)] overflow-hidden !rounded-[var(--radius)] !p-0">
          {loading && rows.length === 0 && (
            <li className="px-4 py-10 font-mono text-sm text-[color:var(--muted)]">
              Listening for enquiries…
            </li>
          )}
          {!loading && rows.length === 0 && !error && (
            <li className="px-4 py-10 font-mono text-sm text-[color:var(--muted)]">
              Inbox empty. Seed with{" "}
              <code className="font-bold text-[color:var(--ink)]">
                npm run seed:inbox
              </code>{" "}
              or paste a new enquiry.
            </li>
          )}
          {!loading && rows.length > 0 && visible.length === 0 && (
            <li className="px-4 py-10 font-mono text-sm text-[color:var(--muted)]">
              {EMPTY[tab]}
            </li>
          )}
          {visible.map((row) => {
            const missing = missingDetails(enquiryText(row));
            const guessed = missing.includes("guests") && !row.approvedAt;
            const guests = guessed ? null : guestsOf(row);
            const live = guessed ? null : liveFeasibility(row, rooms);
            const est = guessed ? null : estTotalOf(row, rooms);
            const pipe = pipelineOf(row);
            const clientPending = row.changeRequest?.status === "pending";
            const flash = flashIds.has(row.id);
            return (
              <li
                key={row.id}
                className={flash ? "inbox-row-flash" : undefined}
              >
                <Link
                  href={`/enquiry/${row.id}`}
                  className="grid grid-cols-1 gap-3 px-4 py-4 transition hover:bg-[color:var(--panel-2)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_4rem_minmax(7rem,1fr)_6.5rem_7rem] lg:items-center lg:gap-4"
                >
                  <span className="truncate font-sans text-sm font-bold">
                    {senderName(row.from)}
                  </span>
                  <span className="truncate text-sm text-[color:var(--muted)]">
                    {row.subject}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[color:var(--muted)] lg:text-right">
                    <span className="mr-2 font-mono text-[10px] uppercase lg:hidden">
                      Guests
                    </span>
                    {guessed && row.parsed ? "?" : guests == null ? "—" : guests}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {clientPending ? (
                      <span className="nb-chip nb-chip-yellow !normal-case">
                        Client changes
                      </span>
                    ) : (
                      <PipelineChip status={pipe} />
                    )}
                    {!guessed && live && (
                      <StatusChip
                        status={live.status}
                        used={live.used}
                        capacity={live.capacity}
                      />
                    )}
                    <ReviewTag
                      parsed={Boolean(row.parsed)}
                      approvedAt={row.approvedAt}
                      needsInfo={needsInfo(missing)}
                    />
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-[color:var(--ink)] lg:text-right">
                    <span className="mr-2 font-mono text-[10px] font-normal uppercase text-[color:var(--muted)] lg:hidden">
                      Est.
                    </span>
                    {est ?? "—"}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--muted)] lg:text-right">
                    {formatWhen(row.receivedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

      <PasteEnquiryModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
      />
    </PageShell>
  );
}
