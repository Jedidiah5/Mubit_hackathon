"use client";

import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDb } from "@/lib/firebase";
import { pipelineOf, type Enquiry, type PipelineStatus } from "@/lib/types";

const STEPS = [
  "Received",
  "Venue reviewing",
  "Proposal ready",
  "Accepted",
] as const;

/** Map pipeline → which timeline step is current (0–3). */
function currentStep(pipeline: PipelineStatus, hasParsed: boolean): number {
  if (pipeline === "accepted") return 3;
  if (pipeline === "proposed" || pipeline === "client_changes") return 2;
  if (hasParsed) return 1;
  return 0;
}

export function StatusClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), "enquiries", id),
      (snap) => {
        if (!snap.exists()) {
          setError("Enquiry not found.");
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

  const pipeline = enquiry ? pipelineOf(enquiry) : null;
  const proposalReady =
    pipeline === "proposed" ||
    pipeline === "client_changes" ||
    pipeline === "accepted";

  const summary = useMemo(() => {
    if (!enquiry?.body) return "";
    const t = enquiry.body.trim();
    return t.length > 300 ? `${t.slice(0, 300).trimEnd()}…` : t;
  }, [enquiry]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-6">
        <p className="font-mono text-sm text-[color:var(--cannot)]">{error}</p>
      </main>
    );
  }

  if (!enquiry || !pipeline) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] p-6">
        <p className="font-mono text-sm text-[color:var(--muted)]">
          Loading your enquiry…
        </p>
      </main>
    );
  }

  const active = currentStep(pipeline, Boolean(enquiry.parsed));

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto w-full max-w-lg px-5 py-10 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          The Wharf Rooms · your enquiry
        </p>
        <h1 className="mt-2 font-sans text-2xl tracking-tight sm:text-3xl">
          {enquiry.subject}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-[color:var(--muted)]">
          Ref {id.slice(0, 8)}
        </p>

        <ol className="mt-10">
          {STEPS.map((label, i) => {
            const done = i < active || (i === active && i === 3);
            const current = i === active;
            const proposalLit = i === 2 && proposalReady;
            const lit = i < active || proposalLit || (i === 3 && done);

            return (
              <li key={label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                      lit || current
                        ? "bg-[color:var(--ink)] text-[color:var(--panel-2)]"
                        : "border border-[color:var(--line)] text-[color:var(--muted)]"
                    }`}
                  >
                    {lit && !current ? "✓" : i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      className={`my-1 w-px min-h-[1.25rem] flex-1 ${
                        i < active
                          ? "bg-[color:var(--ink)]"
                          : "bg-[color:var(--line)]"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-6 pt-1">
                  <p
                    className={`font-sans text-base ${
                      current || proposalLit
                        ? "text-[color:var(--ink)]"
                        : "text-[color:var(--muted)]"
                    }`}
                  >
                    {label}
                  </p>
                  {i === 1 && current && (
                    <p className="mt-1 font-mono text-[11px] text-[color:var(--muted)]">
                      We&apos;re checking rooms and putting a quote together
                    </p>
                  )}
                  {i === 2 && proposalReady && (
                    <p className="mt-1 font-mono text-[11px] text-[color:var(--fits)]">
                      Your proposal is ready to view
                    </p>
                  )}
                  {i === 3 && pipeline === "accepted" && (
                    <p className="mt-1 font-mono text-[11px] text-[color:var(--fits)]">
                      Date held — the venue will confirm shortly
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {proposalReady && (
          <Link
            href={`/p/${id}`}
            className="mt-2 flex w-full items-center justify-center bg-[color:var(--ink)] px-4 py-4 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] transition hover:opacity-90"
          >
            View your proposal
          </Link>
        )}

        {summary && (
          <section className="mt-10 border-t border-[color:var(--line)] pt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Your request
            </p>
            <p className="mt-3 whitespace-pre-wrap font-mono text-sm leading-relaxed text-[color:var(--ink)]/80">
              {summary}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
